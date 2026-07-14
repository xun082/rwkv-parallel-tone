import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildUpstreamBody } from "@/lib/rwkv-payload";
import { resolveServerApiConfig, toSafeApiLabel } from "@/lib/rwkv-config";
import { formatZodError, generateRequestSchema } from "@/lib/schemas";
import type { SensitiveFilterMatcher } from "@/lib/sensitive-filter";
import { getServerSensitiveGuard } from "@/lib/sensitive-guard.server";
import { STYLE_CONFIGS } from "@/lib/style-configs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
 * 上游对单次批量的总量有硬限制：整批 prompt 过大（实测 88 条 × ~780 字符）时
 * 会返回 200 但静默断流，一个 token 都不给；且同一时刻只允许一个批量在跑
 * （否则 409）。因此把 contents 拆成小批串行发送，回传时把批内 index
 * 重映射为全局 index，前端无感知。32 条/批经实测稳定。
 */
const UPSTREAM_CHUNK_SIZE = 32;
const INTER_CHUNK_DELAY_MS = 500;
const BUSY_RETRY_DELAY_MS = 1200;
const MAX_BUSY_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface UpstreamChunk {
  offset: number;
  body: Record<string, unknown>;
}

function buildChunkBodies(
  payload: UpstreamPayload,
  chunkSize: number,
): UpstreamChunk[] {
  const contents = Array.isArray(payload.contents)
    ? (payload.contents as string[])
    : [];
  const chunks: UpstreamChunk[] = [];
  for (let offset = 0; offset < contents.length; offset += chunkSize) {
    chunks.push({
      offset,
      body: { ...payload, contents: contents.slice(offset, offset + chunkSize) },
    });
  }
  return chunks;
}

/** 发送单批请求；上游忙（409）时等待后重试 */
async function fetchUpstreamChunk(
  apiUrl: string,
  chunk: UpstreamChunk,
  signal: AbortSignal,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream, application/json",
      },
      body: JSON.stringify(chunk.body),
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
 * 读取单批上游 SSE，把批内 index 重映射为全局 index 后转发；返回转发的事件数。
 * 若提供 [screen]，则逐 style 累积文本并过滤敏感词：命中后不再转发该 style 的
 * 原始增量（既不落客户端也不落调试日志），改为发送一次 blocked 控制事件。
 */
async function pumpChunkToClient(
  body: ReadableStream<Uint8Array>,
  offset: number,
  controller: ReadableStreamDefaultController<Uint8Array>,
  screen: OutputScreen | null,
): Promise<number> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let events = 0;

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
      if (Array.isArray(parsed.choices)) {
        const outChoices: UpstreamChoice[] = [];
        for (const choice of parsed.choices) {
          if (typeof choice.index === "number") {
            choice.index += offset;
          }
          const screened = screenChoice(choice);
          if (screened) {
            outChoices.push(screened);
          }
        }
        if (outChoices.length === 0) {
          return;
        }
        parsed.choices = outChoices;
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
      events += 1;
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
  } finally {
    reader.releaseLock();
  }
  return events;
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
      { code: "MISSING_API_URL", error: "请在 .env.local 配置 RWKV_API_URL" },
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

  const chunks = buildChunkBodies(upstreamPayload, UPSTREAM_CHUNK_SIZE);

  // 预检第一批：连接失败/鉴权失败仍走 JSON 错误返回，避免给前端一个空的 200 流
  let upstreamResponse: Response;
  const upstreamStartAt = Date.now();
  try {
    upstreamResponse = await fetchUpstreamChunk(apiUrl, chunks[0], request.signal);
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
      ? "密码错误或无权访问 big_batch/completions"
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
      try {
        for (let i = 0; i < chunks.length; i++) {
          if (request.signal.aborted) {
            break;
          }
          // 单批静默失败（200 但没有任何 data 事件）时重试一次
          for (let attempt = 0; attempt < 2; attempt++) {
            let response: Response;
            if (i === 0 && attempt === 0) {
              response = firstResponse;
            } else {
              await sleep(INTER_CHUNK_DELAY_MS);
              try {
                response = await fetchUpstreamChunk(
                  apiUrl,
                  chunks[i],
                  request.signal,
                );
              } catch (error) {
                console.warn(
                  `[/api/generate] run ${runId} chunk ${i} connect error:`,
                  error instanceof Error ? error.message : error,
                );
                break;
              }
              if (!response.ok || !response.body) {
                const detail = await response.text().catch(() => "");
                console.warn(
                  `[/api/generate] run ${runId} chunk ${i} bad response ${response.status}: ${detail.slice(0, 200)}`,
                );
                continue;
              }
            }
            const events = await pumpChunkToClient(
              response.body as ReadableStream<Uint8Array>,
              chunks[i].offset,
              controller,
              outputScreen,
            );
            if (events > 0) {
              break;
            }
            console.warn(
              `[/api/generate] run ${runId} chunk ${i} empty stream (attempt ${attempt + 1}/2)`,
            );
          }
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
