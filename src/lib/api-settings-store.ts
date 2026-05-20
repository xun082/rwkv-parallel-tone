const API_SETTINGS_KEY = "rwkv_api_settings";

export interface ApiSettings {
  apiUrl: string;
  password: string;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadApiSettings(): ApiSettings {
  if (!canUseStorage()) {
    return { apiUrl: "", password: "" };
  }

  try {
    const stored = localStorage.getItem(API_SETTINGS_KEY);
    if (!stored) {
      return { apiUrl: "", password: "" };
    }

    const parsed = JSON.parse(stored) as Partial<ApiSettings>;
    return {
      apiUrl: typeof parsed.apiUrl === "string" ? parsed.apiUrl : "",
      password: typeof parsed.password === "string" ? parsed.password : "",
    };
  } catch (error) {
    console.error("Failed to load API settings:", error);
    return { apiUrl: "", password: "" };
  }
}

export function saveApiSettings(settings: ApiSettings): void {
  if (!canUseStorage()) {
    return;
  }

  const apiUrl = settings.apiUrl.trim();
  const password = settings.password.trim();

  try {
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
  } catch (error) {
    console.error("Failed to save API settings:", error);
  }
}

export function resetApiSettings(): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    localStorage.removeItem(API_SETTINGS_KEY);
  } catch (error) {
    console.error("Failed to reset API settings:", error);
  }
}

/** Values to send to /api/generate; omitted fields fall back to server env. */
export function getApiSettingsPayload(): { apiUrl?: string; password?: string } {
  const { apiUrl, password } = loadApiSettings();
  return {
    ...(apiUrl ? { apiUrl } : {}),
    ...(password ? { password } : {}),
  };
}

export function hasCustomApiSettings(): boolean {
  const { apiUrl, password } = loadApiSettings();
  return Boolean(apiUrl || password);
}
