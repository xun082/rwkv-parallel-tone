import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildUpstreamBody } from "@/lib/rwkv-payload";
import { resolveServerApiConfig, toSafeApiLabel } from "@/lib/rwkv-config";
import { formatZodError, generateRequestSchema } from "@/lib/schemas";
import type { SensitiveFilterMatcher } from "@/lib/sensitive-filter";
import { getServerSensitiveGuard } from "@/lib/sensitive-guard.server";
import { STYLE_CONFIGS } from "@/lib/style-configs";
import { ThinkEchoPeeler } from "@/lib/strip-think-echo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LOG_DIR = join(process.cwd(), ".tone-logs");
const DEBUG_LOG_ENABLED = process.env.NODE_ENV !== "production";

interface UpstreamPayload {
  password?: string;
  contents?: unknown;
  [key: string]: unknown;
}

function safeUpstreamPayload(payload: UpstreamPayload): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...payload };
  if ("password" in clone) {
    const value = clone.password;
    clone.password =
      typeof value === "string" && value.length > 0
        ? `***(${value.length})`
        : value;
  }
  return clone;
}

/**
 * 和 vibe-code 一样先把全部 contents 一次发出去。
 * 部分上游只回 index 0，缺的序号再按条补请求，最多 8 路同时进行。
 */
const UPSTREAM_CONCURRENCY = 8;
const BUSY_RETRY_DELAY_MS = 1200;
const MAX_BUSY_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function payloadForContent(
  payload: UpstreamPayload,
  content: string,
): UpstreamPayload {
  return { ...payload, contents: [content] };
}

/** 上游忙（409）时等待后重试 */
async function fetchUpstream(
  apiUrl: string,
  payload: UpstreamPayload,
  signal: AbortSignal,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream, application/json",
      },
      body: JSON.stringify(payload),
      signal,
      cache: "no-store",
    });
    if (response.status !== 409 || attempt >= MAX_BUSY_RETRIES) {
      return response;
    }
    await response.body?.cancel().catch(() => undefined);
    await sleep(BUSY_RETRY_DELAY_MS);
  }
}

interface UpstreamChoice {
  index?: number;
  delta?: { content?: string };
  blocked?: boolean;
}

/** 逐 style 累积输出并过滤敏感词的共享状态，跨批次持续 */
interface OutputScreen {
  guard: SensitiveFilterMatcher;
  accumulated: Map<number, string>;
  blocked: Set<number>;
}

/**
 * 读取上游 SSE 并转发；返回已经写出正文的全局 index。
 * 若提供 [screen]，则逐 style 累积文本并过滤敏感词：命中后不再转发该 style 的
 * 原始增量（既不落客户端也不落调试日志），改为发送一次 blocked 控制事件。
 */
async function pumpChunkToClient(
  body: ReadableStream<Uint8Array>,
  offset: number,
  controller: ReadableStreamDefaultController<Uint8Array>,
  screen: OutputScreen | null,
): Promise<Set<number>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  const filled = new Set<number>();
  const peelers = new Map<number, ThinkEchoPeeler>();

  const peelDelta = (index: number, delta: string, eof = false): string => {
    let peeler = peelers.get(index);
    if (!peeler) {
      peeler = new ThinkEchoPeeler();
      peelers.set(index, peeler);
    }
    return eof ? peeler.finish() : peeler.push(delta);
  };

  const enqueueChoices = (choices: UpstreamChoice[]) => {
    if (choices.length === 0) {
      return;
    }
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({ choices })}\n\n`),
    );
  };

  const screenChoice = (choice: UpstreamChoice): UpstreamChoice | null => {
    if (!screen || typeof choice.index !== "number") {
      return choice;
    }
    const gi = choice.index;
    if (screen.blocked.has(gi)) {
      return null; // 已屏蔽：丢弃后续增量
    }
    const delta = choice.delta?.content ?? "";
    if (!delta) {
      return choice;
    }
    const acc = (screen.accumulated.get(gi) ?? "") + delta;
    screen.accumulated.set(gi, acc);
    if (screen.guard.isSensitive(acc)) {
      screen.blocked.add(gi);
      return { index: gi, blocked: true };
    }
    return choice;
  };

  const emitLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line.startsWith("data: ")) {
      return;
    }
    const payload = line.slice(6);
    if (payload === "[DONE]") {
      return;
    }
    try {
      const parsed = JSON.parse(payload) as { choices?: UpstreamChoice[] };
      if (!Array.isArray(parsed.choices)) {
        return;
      }
      const outChoices: UpstreamChoice[] = [];
      for (const choice of parsed.choices) {
        const next: UpstreamChoice = { ...choice, delta: choice.delta ? { ...choice.delta } : choice.delta };
        if (typeof next.index === "number") {
          next.index += offset;
        }
        if (typeof next.index === "number" && next.delta?.content) {
          const content = peelDelta(next.index, next.delta.content);
          if (!content) {
            continue;
          }
          next.delta = { content };
        }
        const screened = screenChoice(next);
        if (!screened) {
          continue;
        }
        outChoices.push(screened);
        const wrote =
          Boolean(screened.blocked) ||
          Boolean(screened.delta?.content);
        if (wrote && typeof screened.index === "number") {
          filled.add(screened.index);
        }
      }
      enqueueChoices(outChoices);
    } catch {
      // 忽略偶发的非 JSON 行
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        emitLine(line);
      }
    }
    if (buffer) {
      emitLine(buffer);
    }
    const tail: UpstreamChoice[] = [];
    for (const index of peelers.keys()) {
      const content = peelDelta(index, "", true);
      if (!content) {
        continue;
      }
      const screened = screenChoice({ index, delta: { content } });
      if (!screened) {
        continue;
      }
      tail.push(screened);
      if (typeof screened.index === "number") {
        filled.add(screened.index);
      }
    }
    enqueueChoices(tail);
  } finally {
    reader.releaseLock();
  }
  return filled;
}

function makeRunId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `${stamp}-${rand}`;
}

/** 把上游 SSE body 同时落盘到 file，并返回另一路给客户端 */
function teeUpstreamToFile(
  body: ReadableStream<Uint8Array>,
  filePath: string,
  onDone: (meta: { bytes: number; ms: number; error?: string }) => void,
): ReadableStream<Uint8Array> {
  const [forClient, forDisk] = body.tee();
  const startedAt = Date.now();

  void (async () => {
    const writer = createWriteStream(filePath);
    const reader = forDisk.getReader();
    let bytes = 0;
    let error: string | undefined;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          bytes += value.byteLength;
          writer.write(value);
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      writer.end();
      reader.releaseLock();
      onDone({ bytes, ms: Date.now() - startedAt, error });
    }
  })();

  return forClient;
}

export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const parsed = generateRequestSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_REQUEST", error: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  // 敏感词过滤：词表已内联进服务端构建，直接同步取用。
  const guard: SensitiveFilterMatcher = getServerSensitiveGuard();

  if (guard.isSensitive(parsed.data.userInput)) {
    return Response.json(
      { code: "BLOCKED_INPUT", error: "输入包含敏感内容，已拦截，请修改后重试" },
      { status: 422 },
    );
  }

  const outputScreen: OutputScreen | null = guard.isEmpty
    ? null
    : { guard, accumulated: new Map<number, string>(), blocked: new Set<number>() };

  const { apiUrl, password } = resolveServerApiConfig({
    apiUrl: parsed.data.apiUrl,
    password: parsed.data.password,
  });

  if (!apiUrl) {
    return Response.json(
      {
        code: "MISSING_API_URL",
        error:
          "请在 .env 配置 RWKV_API_URL（例如 http://192.168.0.115:8030/v1/chat/completions）",
      },
      { status: 500 },
    );
  }

  const styles = parsed.data.styles ?? STYLE_CONFIGS;
  const upstreamPayload = buildUpstreamBody(
    parsed.data.userInput,
    styles,
    password,
  );

  const runId = makeRunId();
  let logBaseDir: string | null = null;
  if (DEBUG_LOG_ENABLED) {
    try {
      await mkdir(LOG_DIR, { recursive: true });
      logBaseDir = LOG_DIR;
      await writeFile(
        join(LOG_DIR, `${runId}.request.json`),
        JSON.stringify(
          {
            runId,
            ts: new Date().toISOString(),
            api: toSafeApiLabel(apiUrl),
            userInput: parsed.data.userInput,
            styleNames: styles.map((s) => s.name),
            styleCount: styles.length,
            promptOverridesProvided: Boolean(parsed.data.styles),
            upstreamPayload: safeUpstreamPayload(upstreamPayload),
          },
          null,
          2,
        ),
        "utf8",
      );
      console.log(
        `[/api/generate] run ${runId} → ${toSafeApiLabel(apiUrl)} (${styles.length} styles)`,
      );
    } catch (err) {
      logBaseDir = null;
      console.warn("[/api/generate] log dir init failed:", err);
    }
  }

  const contents = Array.isArray(upstreamPayload.contents)
    ? (upstreamPayload.contents as string[])
    : [];

  // 预检整包：连接失败/鉴权失败仍走 JSON 错误返回，避免给前端一个空的 200 流
  let upstreamResponse: Response;
  const upstreamStartAt = Date.now();
  try {
    upstreamResponse = await fetchUpstream(apiUrl, upstreamPayload, request.signal);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "无法连接上游 RWKV 服务";
    console.error("[/api/generate] connect error:", {
      runId,
      api: toSafeApiLabel(apiUrl),
      message,
    });
    if (logBaseDir) {
      await writeFile(
        join(logBaseDir, `${runId}.error.txt`),
        `connect error: ${message}\n`,
        "utf8",
      ).catch(() => undefined);
    }
    return Response.json(
      {
        code: "UPSTREAM_CONNECT_ERROR",
        error: `无法连接 ${toSafeApiLabel(apiUrl)}：${message}`,
        api: toSafeApiLabel(apiUrl),
      },
      { status: 502 },
    );
  }

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    const errorText = await upstreamResponse.text();
    const upstreamStatus = upstreamResponse.status;
    const isAuthError = upstreamStatus === 401 || upstreamStatus === 403;
    const responseStatus = upstreamStatus >= 500 ? 502 : upstreamStatus;
    const message = isAuthError
      ? "密码错误或无权访问 /v1/chat/completions"
      : `上游请求失败 (${upstreamStatus})`;

    console.error("[/api/generate] bad response:", {
      runId,
      api: toSafeApiLabel(apiUrl),
      status: upstreamStatus,
      detail: errorText.slice(0, 300),
    });
    if (logBaseDir) {
      await writeFile(
        join(logBaseDir, `${runId}.error.txt`),
        `status: ${upstreamStatus}\ncontent-type: ${upstreamResponse.headers.get("content-type") ?? ""}\nbody:\n${errorText}\n`,
        "utf8",
      ).catch(() => undefined);
    }
    return Response.json(
      {
        code: isAuthError ? "UPSTREAM_AUTH_ERROR" : "UPSTREAM_BAD_RESPONSE",
        error: message,
        upstreamStatus,
        detail: errorText.slice(0, 600),
        api: toSafeApiLabel(apiUrl),
      },
      { status: responseStatus },
    );
  }

  const firstResponse = upstreamResponse;
  const encoder = new TextEncoder();
  let clientBody = new ReadableStream<Uint8Array>({
    async start(controller) {
      const pumpStyle = async (
        index: number,
        preset?: Response,
      ): Promise<void> => {
        const content = contents[index] ?? "";
        for (let attempt = 0; attempt < 2; attempt++) {
          if (request.signal.aborted) {
            return;
          }
          let response = preset;
          preset = undefined;
          if (!response) {
            try {
              response = await fetchUpstream(
                apiUrl,
                payloadForContent(upstreamPayload, content),
                request.signal,
              );
            } catch (error) {
              console.warn(
                `[/api/generate] run ${runId} style ${index} connect error:`,
                error instanceof Error ? error.message : error,
              );
              return;
            }
          }
          if (!response.ok || !response.body) {
            const detail = await response.text().catch(() => "");
            console.warn(
              `[/api/generate] run ${runId} style ${index} bad response ${response.status}: ${detail.slice(0, 200)}`,
            );
            continue;
          }
          const filled = await pumpChunkToClient(
            response.body,
            index,
            controller,
            outputScreen,
          );
          if (filled.size > 0) {
            return;
          }
          console.warn(
            `[/api/generate] run ${runId} style ${index} empty stream (attempt ${attempt + 1}/2)`,
          );
        }
      };

      try {
        const filled = await pumpChunkToClient(
          firstResponse.body,
          0,
          controller,
          outputScreen,
        );
        const missing = contents
          .map((_, index) => index)
          .filter((index) => !filled.has(index));
        if (missing.length > 0 && missing.length < contents.length) {
          console.warn(
            `[/api/generate] run ${runId} batch returned ${filled.size}/${contents.length}, filling ${missing.length}`,
          );
        }
        let cursor = 0;
        const worker = async (): Promise<void> => {
          while (!request.signal.aborted) {
            const index = cursor;
            cursor += 1;
            const styleIndex = missing[index];
            if (styleIndex === undefined) {
              return;
            }
            await pumpStyle(styleIndex);
          }
        };
        const workers = Math.min(UPSTREAM_CONCURRENCY, missing.length);
        if (workers > 0) {
          await Promise.all(Array.from({ length: workers }, () => worker()));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        // 客户端断开或上游流中断：结束响应即可
        console.warn(
          `[/api/generate] run ${runId} stream interrupted:`,
          error instanceof Error ? error.message : error,
        );
      } finally {
        try {
          controller.close();
        } catch {
          // controller 可能已因客户端断开而关闭
        }
      }
    },
  });
  if (logBaseDir) {
    const ssePath = join(logBaseDir, `${runId}.response.sse`);
    clientBody = teeUpstreamToFile(
      clientBody,
      ssePath,
      ({ bytes, ms, error }) => {
        const head = `[/api/generate] run ${runId} done in ${ms}ms, ${bytes} bytes → ${ssePath}`;
        if (error) {
          console.warn(`${head} (tee error: ${error})`);
        } else {
          console.log(head);
        }
      },
    );
    console.log(
      `[/api/generate] run ${runId} streaming (connected in ${Date.now() - upstreamStartAt}ms), tee → ${ssePath}`,
    );
  }

  return new Response(clientBody, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Run-Id": runId,
    },
  });
}
