import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildUpstreamBody } from "@/lib/rwkv-payload";
import { resolveServerApiConfig, toSafeApiLabel } from "@/lib/rwkv-config";
import { formatZodError, generateRequestSchema } from "@/lib/schemas";
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

  let upstreamResponse: Response;
  const upstreamStartAt = Date.now();
  try {
    upstreamResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream, application/json",
      },
      body: JSON.stringify(upstreamPayload),
      signal: request.signal,
      cache: "no-store",
    });
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

  let clientBody: ReadableStream<Uint8Array> = upstreamResponse.body;
  if (logBaseDir) {
    const ssePath = join(logBaseDir, `${runId}.response.sse`);
    clientBody = teeUpstreamToFile(
      upstreamResponse.body,
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
