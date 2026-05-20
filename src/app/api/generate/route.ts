import { appendStrictOutputRules, normalizePrompt } from "@/lib/prompt-rules";
import { type StyleConfig, STYLE_CONFIGS } from "@/lib/style-configs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GenerateRequestBody {
  userInput?: string;
  styles?: StyleConfig[];
  apiUrl?: string;
  password?: string;
}

const DEFAULT_MODEL_PARAMS = {
  max_tokens: 100,
  temperature: 0.95,
  top_k: 50,
  top_p: 0.9,
  pad_zero: true,
  alpha_presence: 1.0,
  alpha_frequency: 1.0,
  alpha_decay: 0.996,
  chunk_size: 128,
  stream: true,
};

function isStyleConfig(value: unknown): value is StyleConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StyleConfig>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.color === "string" &&
    typeof candidate.icon === "string" &&
    typeof candidate.prompt === "string"
  );
}

function buildContents(userInput: string, styles: StyleConfig[]): string[] {
  return styles.map((style) => {
    const promptWithRules = appendStrictOutputRules(style.prompt);

    if (promptWithRules.includes("${{input}}")) {
      return normalizePrompt(
        promptWithRules.replace(/\$\{\{input\}\}/g, userInput),
      );
    }

    return normalizePrompt(
      `${promptWithRules}\n待改写内容：${userInput}\nAssistant: <think>\n</think>`,
    );
  });
}

function resolveApiConfig(overrides?: {
  apiUrl?: string;
  password?: string;
}): { apiUrl: string; password: string } {
  const overrideUrl = overrides?.apiUrl?.trim();
  const overridePassword = overrides?.password?.trim();

  return {
    apiUrl: overrideUrl || process.env.RWKV_API_URL?.trim() || "",
    password: overridePassword || process.env.RWKV_PASSWORD?.trim() || "",
  };
}

function toSafeApiLabel(apiUrl: string): string {
  try {
    const url = new URL(apiUrl);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return apiUrl;
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: GenerateRequestBody;
  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { apiUrl, password } = resolveApiConfig({
    apiUrl: body.apiUrl,
    password: body.password,
  });

  if (!apiUrl) {
    return Response.json(
      {
        code: "MISSING_API_URL",
        error: "缺少上游 API URL 配置",
      },
      { status: 500 },
    );
  }

  const userInput = body.userInput?.trim();
  if (!userInput) {
    return Response.json({ error: "userInput 不能为空" }, { status: 400 });
  }

  const styles = Array.isArray(body.styles)
    ? body.styles.filter(isStyleConfig)
    : STYLE_CONFIGS;

  if (styles.length === 0) {
    return Response.json({ error: "至少需要一个风格配置" }, { status: 400 });
  }

  const contents = buildContents(userInput, styles);
  const upstreamPayload: Record<string, unknown> = {
    ...DEFAULT_MODEL_PARAMS,
    contents,
    ...(password ? { password } : {}),
  };

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      body: JSON.stringify(upstreamPayload),
      signal: request.signal,
      cache: "no-store",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "无法连接上游 RWKV 服务";
    console.error("[/api/generate] Upstream connect error:", {
      api: toSafeApiLabel(apiUrl),
      message,
    });
    return Response.json(
      {
        code: "UPSTREAM_CONNECT_ERROR",
        error: message,
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
      ? "上游返回 401/403：当前节点对 chat/completions 开启了鉴权（即使 models 接口可访问）"
      : `上游 RWKV 请求失败: ${upstreamResponse.status} ${upstreamResponse.statusText}`;

    console.error("[/api/generate] Upstream bad response:", {
      api: toSafeApiLabel(apiUrl),
      status: upstreamStatus,
      statusText: upstreamResponse.statusText,
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
