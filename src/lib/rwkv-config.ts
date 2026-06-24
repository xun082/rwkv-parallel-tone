/**
 * 上游 RWKV 的采样参数。
 *
 * prompt 包裹格式（见 rwkv-payload.ts）：
 *   {systemPrompt}\n\nUser: {userInput}\n\nAssistant:<think>\n</think>
 */
export const RWKV_MODEL_PARAMS = {
  max_tokens: 320,
  temperature: 0.95,
  top_k: 50,
  top_p: 0.5,
  pad_zero: true,
  alpha_presence: 1.0,
  alpha_frequency: 1.0,
  alpha_decay: 0.996,
  chunk_size: 128,
  stream: true,
} as const;

function readEnv(name: "RWKV_API_URL" | "RWKV_PASSWORD"): string {
  return process.env[name] ?? "";
}

export function getEnvRwkvConfig(): { apiUrl: string; password: string } {
  return {
    apiUrl: readEnv("RWKV_API_URL"),
    password: readEnv("RWKV_PASSWORD"),
  };
}

/**
 * env 优先：本地/自部署只要配了 .env.local，永远以 env 为准；
 * 仅当 env 中对应字段为空（如部分线上环境没注入 env）时，才回退到前端传来的 UI 配置。
 */
export function resolveServerApiConfig(overrides?: {
  apiUrl?: string;
  password?: string;
}): { apiUrl: string; password: string } {
  const env = getEnvRwkvConfig();
  return {
    apiUrl: env.apiUrl || overrides?.apiUrl || "",
    password: env.password || overrides?.password || "",
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
