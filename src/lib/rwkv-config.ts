export const RWKV_MODEL_PARAMS = {
  max_tokens: 150,
  temperature: 0.95,
  top_k: 50,
  top_p: 0.9,
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

export function resolveServerApiConfig(overrides?: {
  apiUrl?: string;
  password?: string;
}): { apiUrl: string; password: string } {
  const env = getEnvRwkvConfig();
  return {
    apiUrl: overrides?.apiUrl ?? env.apiUrl,
    password: overrides?.password ?? env.password,
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
