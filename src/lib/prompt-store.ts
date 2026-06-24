import { STYLE_CONFIGS, type StyleConfig } from "@/lib/style-configs";

const PROMPT_CUSTOMIZATIONS_KEY = "style_prompt_customizations";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function saveCustomPrompts(customizations: Record<string, string>): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    localStorage.setItem(PROMPT_CUSTOMIZATIONS_KEY, JSON.stringify(customizations));
  } catch (error) {
    console.error("Failed to save custom prompts:", error);
  }
}

export function loadCustomPrompts(): Record<string, string> {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const stored = localStorage.getItem(PROMPT_CUSTOMIZATIONS_KEY);
    if (stored) {
      return JSON.parse(stored) as Record<string, string>;
    }
  } catch (error) {
    console.error("Failed to load custom prompts:", error);
  }

  return {};
}

export function resetCustomPrompts(): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    localStorage.removeItem(PROMPT_CUSTOMIZATIONS_KEY);
  } catch (error) {
    console.error("Failed to reset custom prompts:", error);
  }
}

export function getMergedStyleConfigs(): StyleConfig[] {
  const customPrompts = loadCustomPrompts();
  return STYLE_CONFIGS.map((config) => ({
    ...config,
    prompt: customPrompts[config.name] || config.prompt,
  }));
}
