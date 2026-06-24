/**
 * 极简输出约束，附加到每个 style prompt 末尾。
 * 关键：用极短的正向描述，避免模型把规则当作要续写的内容。
 */
export const STRICT_OUTPUT_RULES = `重要：请直接输出改写后的中文正文，不要使用任何代码块标记，不要有任何多余的解释、前言、标签或确认语，只输出改写正文本身。`;

export function appendStrictOutputRules(prompt: string): string {
  return `${prompt}\n\n${STRICT_OUTPUT_RULES}`;
}
