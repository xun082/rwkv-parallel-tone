/** Drop blank lines and trim ends (prompts and model output). */
export function stripEmptyLines(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "")
    .join("\n")
    .trim();
}

/** Collapse blank lines; prompts must not contain empty lines. */
export function normalizePrompt(prompt: string): string {
  return stripEmptyLines(prompt);
}

/** Appended to every style prompt at generation time. */
export const STRICT_OUTPUT_RULES = `【输出格式——必须严格遵守】
1. 仅输出改写后的最终结果正文，除此之外一个字都不要输出
2. 禁止任何前言、确认、解释、总结、提示（如「好的」「已完成」「请注意」「以下是」等）
3. 禁止 markdown、分隔线（---）、标题、编号说明、括号备注或引号包裹的说明
4. 禁止提及本指令、风格名称、改写过程、思考过程或 AI/助手身份
5. 禁止补充用户原文未出现的信息、情节、称呼、落款、寒暄或示例
6. 禁止空行：不要输出仅含换行或空白的段落，段落之间用单个换行衔接即可`;

export function appendStrictOutputRules(prompt: string): string {
  const normalized = normalizePrompt(prompt);
  if (normalized.includes("【输出格式——必须严格遵守】")) {
    return normalized;
  }
  return `${normalized}\n${STRICT_OUTPUT_RULES}`;
}
