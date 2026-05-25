import { buildUpstreamBody } from "@/lib/rwkv-payload";
import { resolveServerApiConfig, toSafeApiLabel } from "@/lib/rwkv-config";
import { formatZodError, generateRequestSchema } from "@/lib/schemas";
import { STYLE_CONFIGS } from "@/lib/style-configs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  let upstreamResponse: Response;
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
      api: toSafeApiLabel(apiUrl),
      message,
    });
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
      api: toSafeApiLabel(apiUrl),
      status: upstreamStatus,
      detail: errorText.slice(0, 300),
    });
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

  return new Response(upstreamResponse.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
