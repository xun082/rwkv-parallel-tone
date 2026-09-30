/**
 * 上游 RWKV 的采样参数。字段对齐 vibe-code 的 /v1/chat/completions 批量接口。
 *
 * prompt 包裹格式（见 rwkv-payload.ts）：
 *   {systemPrompt}\n\nUser: {userInput}\n\nAssistant: <think></think
 *
 * 采样字段对齐 vibe-code 的批量补全。max_tokens 用 2000。
 */
export const RWKV_MODEL_PARAMS = {
  max_tokens: 2000,
  temperature: 1.0,
  top_k: 60,
  top_p: 0.5,
  pad_zero: true,
  alpha_presence: 1.0,
  alpha_frequency: 0.1,
  alpha_decay: 0.99,
  chunk_size: 128,
  stream: true,
  enable_think: false,
} as const;

const COMPLETIONS_PATH = "/v1/chat/completions";
const LEGACY_BATCH_PATH = "/big_batch/completions";

function readEnv(name: "RWKV_API_URL" | "RWKV_PASSWORD"): string {
  return process.env[name]?.trim() ?? "";
}

/**
 * 和 vibe-code 一样打 /v1/chat/completions。
 * 根路径或缺路径会补全；旧的 /big_batch/completions 也会改写到这个路径。
 */
export function normalizeRwkvApiUrl(raw: string): string | null {
  const input = raw.trim();
  if (!input) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  if (!parsed.hostname) {
    return null;
  }

  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === LEGACY_BATCH_PATH) {
    parsed.pathname = COMPLETIONS_PATH;
  }
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString();
}

export function getEnvRwkvConfig(): { apiUrl: string; password: string } {
  return {
    apiUrl: readEnv("RWKV_API_URL"),
    password: readEnv("RWKV_PASSWORD"),
  };
}

/**
 * env 优先：本地/自部署只要配了 .env / .env.local，永远以 env 为准；
 * 仅当 env 中对应字段为空（如部分线上环境没注入 env）时，才回退到前端传来的 UI 配置。
 */
export function resolveServerApiConfig(overrides?: {
  apiUrl?: string;
  password?: string;
}): { apiUrl: string; password: string } {
  const env = getEnvRwkvConfig();
  return {
    apiUrl:
      normalizeRwkvApiUrl(env.apiUrl || overrides?.apiUrl || "") ?? "",
    password: env.password || overrides?.password?.trim() || "",
  };
}

export function toSafeApiLabel(apiUrl: string): string {
  try {
    const url = new URL(apiUrl);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return apiUrl;
  }
}
