import {
  apiSettingsSchema,
  type ApiSettings,
} from "@/lib/schemas";

const API_SETTINGS_KEY = "rwkv_api_settings";
const EMPTY_SETTINGS: ApiSettings = { apiUrl: "", password: "" };

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export type { ApiSettings };

export function loadApiSettings(): ApiSettings {
  if (!canUseStorage()) {
    return EMPTY_SETTINGS;
  }

  try {
    const stored = localStorage.getItem(API_SETTINGS_KEY);
    if (!stored) {
      return EMPTY_SETTINGS;
    }

    const parsed = apiSettingsSchema.safeParse(JSON.parse(stored));
    if (!parsed.success) {
      localStorage.removeItem(API_SETTINGS_KEY);
      return EMPTY_SETTINGS;
    }

    return parsed.data;
  } catch {
    localStorage.removeItem(API_SETTINGS_KEY);
    return EMPTY_SETTINGS;
  }
}

export function saveApiSettings(settings: ApiSettings): void {
  if (!canUseStorage()) {
    return;
  }

  const parsed = apiSettingsSchema.safeParse(settings);
  if (!parsed.success) {
    throw new Error("API 配置校验失败");
  }

  const { apiUrl, password } = parsed.data;

  if (!apiUrl && !password) {
    localStorage.removeItem(API_SETTINGS_KEY);
    return;
  }

  localStorage.setItem(
    API_SETTINGS_KEY,
    JSON.stringify({
      ...(apiUrl ? { apiUrl } : {}),
      ...(password ? { password } : {}),
    }),
  );
}

export function resetApiSettings(): void {
  if (!canUseStorage()) {
    return;
  }

  localStorage.removeItem(API_SETTINGS_KEY);
}

/**
 * 服务端解析时 env 优先；这里上传的字段仅在对应 env 为空（如线上未注入 env）时生效，作为兜底。
 */
export function getApiSettingsPayload(): { apiUrl?: string; password?: string } {
  const { apiUrl, password } = loadApiSettings();
  return {
    ...(apiUrl ? { apiUrl } : {}),
    ...(password ? { password } : {}),
  };
}
