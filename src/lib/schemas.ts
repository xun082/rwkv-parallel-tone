import { z } from "zod";

export const styleConfigSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1),
  icon: z.string().min(1),
  prompt: z.string().min(1),
});

export const userInputSchema = z
  .string()
  .min(1, "请输入要改写的内容");

export const apiSettingsSchema = z.object({
  apiUrl: z.union([z.literal(""), z.string().url("API URL 格式不正确")]),
  password: z.union([z.literal(""), z.string().min(1, "密码不能为空")]),
});

export const generateRequestSchema = z.object({
  userInput: userInputSchema,
  styles: z.array(styleConfigSchema).optional(),
  apiUrl: z.string().url("API URL 格式不正确").optional(),
  password: z.string().min(1, "密码不能为空").optional(),
});

export type ApiSettings = z.infer<typeof apiSettingsSchema>;
export type StyleConfigInput = z.infer<typeof styleConfigSchema>;

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("；");
}
