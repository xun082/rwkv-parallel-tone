import { appendStrictOutputRules, normalizePrompt } from "@/lib/prompt-rules";
import { RWKV_MODEL_PARAMS } from "@/lib/rwkv-config";
import { type StyleConfig } from "@/lib/style-configs";

export function buildPromptContents(
  userInput: string,
  styles: StyleConfig[],
): string[] {
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

export function buildUpstreamBody(
  userInput: string,
  styles: StyleConfig[],
  password: string,
): Record<string, unknown> {
  return {
    ...RWKV_MODEL_PARAMS,
    contents: buildPromptContents(userInput, styles),
    ...(password ? { password } : {}),
  };
}
