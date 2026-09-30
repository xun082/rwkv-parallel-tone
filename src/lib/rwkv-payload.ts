import { appendStrictOutputRules } from "@/lib/prompt-rules";
import { RWKV_MODEL_PARAMS } from "@/lib/rwkv-config";
import { type StyleConfig } from "@/lib/style-configs";

/**
 * RWKV chat 包裹格式：
 *
 *   {systemPrompt}\n\nUser: {userInput}\n\nAssistant: <think></think
 *
 * 和 vibe-code 一样：整段放进 contents，助手侧用空 think 前缀结束。
 */
export function buildPromptContents(
  userInput: string,
  styles: StyleConfig[],
): string[] {
  return styles.map((style) => {
    const systemPrompt = appendStrictOutputRules(style.prompt);
    return `${systemPrompt}\n\nUser: ${userInput}\n\nAssistant: <think></think`;
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
