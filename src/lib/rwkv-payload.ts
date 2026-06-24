import { appendStrictOutputRules } from "@/lib/prompt-rules";
import { RWKV_MODEL_PARAMS } from "@/lib/rwkv-config";
import { type StyleConfig } from "@/lib/style-configs";

/**
 * RWKV chat 包裹格式：
 *
 *   {systemPrompt}\n\nUser: {userInput}\n\nAssistant:<think>\n</think>
 *
 * 三个关键点：
 * 1. systemPrompt 独立放在最前，保留多行/列表结构（不再压成单行），
 *    模型把它读作系统指令；
 * 2. `User: ...` 只放真正的用户输入，避免模型把指令误当作要续写的对话；
 * 3. `Assistant:<think>\n</think>` 用空 <think> 块手动跳过思考阶段，
 *    告诉模型"思考完毕，请直接输出正文"，否则它会自己拼一段
 *    `<think>……</think>` 把 max_tokens 吃光。
 */
export function buildPromptContents(
  userInput: string,
  styles: StyleConfig[],
): string[] {
  return styles.map((style) => {
    const systemPrompt = appendStrictOutputRules(style.prompt);
    return `${systemPrompt}\n\nUser: ${userInput}\n\nAssistant:<think>\n</think>`;
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
