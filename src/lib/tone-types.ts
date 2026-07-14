import type { StyleConfig } from "@/lib/style-configs";
import { getStyleAvatarUrl } from "@/lib/style-avatars";

export interface ToneResult {
  index: number;
  style: string;
  content: string;
  isComplete: boolean;
  blocked: boolean;
  avatarUrl: string;
}

export function buildInitialResults(configs: StyleConfig[]): ToneResult[] {
  return configs.map((config, index) => ({
    index,
    style: config.name,
    content: "",
    isComplete: false,
    blocked: false,
    avatarUrl: getStyleAvatarUrl(config.name),
  }));
}
