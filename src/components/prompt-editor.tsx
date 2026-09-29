"use client";

import { useMemo, useState } from "react";
import { STYLE_CONFIGS } from "@/lib/style-configs";
import {
  loadApiSettings,
  resetApiSettings,
  saveApiSettings,
  type ApiSettings,
} from "@/lib/api-settings-store";
import { apiSettingsSchema, formatZodError } from "@/lib/schemas";
import {
  getMergedStyleConfigs,
  resetCustomPrompts,
  saveCustomPrompts,
} from "@/lib/prompt-store";
import { StyleAvatar } from "@/components/style-avatar";

function cn(...classes: Array<string | null | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

export interface PromptEditorProps {
  onClose: () => void;
  onSaved: () => void;
}

export function PromptEditor({ onClose, onSaved }: PromptEditorProps): React.JSX.Element {
  const [edits, setEdits] = useState<Record<string, string>>(() => {
    const merged = getMergedStyleConfigs();
    const nextEdits: Record<string, string> = {};
    for (const config of merged) {
      nextEdits[config.name] = config.prompt;
    }

    return nextEdits;
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [apiSettings, setApiSettings] = useState<ApiSettings>(() => loadApiSettings());
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) {
      return STYLE_CONFIGS;
    }

    return STYLE_CONFIGS.filter((config) => {
      const prompt = edits[config.name] ?? config.prompt;
      return (
        config.name.toLowerCase().includes(keyword) ||
        prompt.toLowerCase().includes(keyword)
      );
    });
  }, [edits, searchTerm]);

  const handleSave = () => {
    const apiResult = apiSettingsSchema.safeParse(apiSettings);
    if (!apiResult.success) {
      setSettingsError(formatZodError(apiResult.error));
      return;
    }

    const customizations: Record<string, string> = {};

    for (const defaultConfig of STYLE_CONFIGS) {
      const editedPrompt = edits[defaultConfig.name];
      if (
        typeof editedPrompt === "string" &&
        editedPrompt !== defaultConfig.prompt
      ) {
        customizations[defaultConfig.name] = editedPrompt;
      }
    }

    saveCustomPrompts(customizations);
    saveApiSettings(apiResult.data);
    setSettingsError(null);
    onSaved();
    onClose();
  };

  const handleResetApiSettings = () => {
    resetApiSettings();
    setApiSettings({ apiUrl: "", password: "" });
    setSettingsError(null);
  };

  const handleResetAll = () => {
    if (!window.confirm("确定重置全部自定义模板和 API 配置吗？")) {
      return;
    }

    resetCustomPrompts();
    resetApiSettings();
    setApiSettings({ apiUrl: "", password: "" });
    const defaultEdits: Record<string, string> = {};
    for (const config of STYLE_CONFIGS) {
      defaultEdits[config.name] = config.prompt;
    }

    setEdits(defaultEdits);
    onSaved();
  };

  const handleResetSingle = (styleName: string) => {
    const defaultConfig = STYLE_CONFIGS.find((item) => item.name === styleName);
    if (!defaultConfig) {
      return;
    }

    setEdits((prev) => ({
      ...prev,
      [styleName]: defaultConfig.prompt,
    }));
  };

  const customizedCount = STYLE_CONFIGS.filter((item) => {
    const value = edits[item.name];
    return typeof value === "string" && value !== item.prompt;
  }).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between border-b border-zinc-800 bg-linear-to-r from-zinc-900 to-zinc-950 p-5">
          <div>
            <h2 className="text-xl font-bold text-zinc-100">编辑 Prompt 模板</h2>
            <p className="mt-2 text-sm text-zinc-400">
              支持使用 <code className="rounded bg-zinc-800 px-1 text-zinc-200">${"{{input}}"}</code>
              占位符；未使用占位符时会自动追加用户输入。下方 API 配置有值时优先于{" "}
              <code className="rounded bg-zinc-800 px-1 text-zinc-200">.env.local</code>
              ，留空则使用环境变量。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
              onClick={handleResetAll}
              type="button"
            >
              重置全部
            </button>
            <button
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
              onClick={onClose}
              type="button"
            >
              关闭
            </button>
          </div>
        </div>

        <div className="space-y-4 border-b border-zinc-800 p-5">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">API 配置</h3>
              <button
                className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
                onClick={handleResetApiSettings}
                type="button"
              >
                恢复环境变量
              </button>
            </div>
            <p className="mb-3 text-xs text-zinc-500">
              优先使用 <code className="rounded bg-zinc-800 px-1 text-zinc-300">.env.local</code>{" "}
              中的 <code className="rounded bg-zinc-800 px-1 text-zinc-300">RWKV_API_URL</code> /{" "}
              <code className="rounded bg-zinc-800 px-1 text-zinc-300">RWKV_PASSWORD</code>；当 env
              未配置（如线上）时，才会用这里填写的值兜底。
            </p>
            {settingsError && (
              <p className="mb-3 text-xs text-amber-400">{settingsError}</p>
            )}
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs text-zinc-400">API URL（可选）</span>
                <input
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 font-mono text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-cyan-500"
                  value={apiSettings.apiUrl}
                  onChange={(event) =>
                    setApiSettings((prev) => ({ ...prev, apiUrl: event.target.value }))
                  }
                  placeholder="留空则使用 RWKV_API_URL，例如 http://192.168.0.12:8000/v1/chat/completions"
                  type="url"
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-zinc-400">密码（可选）</span>
                <input
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 font-mono text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-cyan-500"
                  value={apiSettings.password}
                  onChange={(event) =>
                    setApiSettings((prev) => ({ ...prev, password: event.target.value }))
                  }
                  placeholder="留空则使用 RWKV_PASSWORD"
                  type="password"
                  autoComplete="off"
                />
              </label>
            </div>
          </div>

          <input
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-cyan-500"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="搜索风格或模板内容"
          />
        </div>

        <div className="tone-scrollbar flex-1 space-y-4 overflow-y-auto bg-zinc-950 p-5">
          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900 p-10 text-center text-zinc-400">
              没有匹配的风格
            </div>
          )}

          {filtered.map((config) => {
            const editedPrompt = edits[config.name] ?? config.prompt;
            const isCustomized = editedPrompt !== config.prompt;

            return (
              <div
                key={config.name}
                className={cn(
                  "rounded-2xl border bg-zinc-900 p-4 shadow-sm",
                  isCustomized ? "border-cyan-500/70" : "border-zinc-800",
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <StyleAvatar height={40} styleName={config.name} width={60} />
                    <strong className="truncate text-zinc-100">{config.name}</strong>
                    {isCustomized && (
                      <span className="rounded-full bg-cyan-500/20 px-2 py-1 text-xs font-semibold text-cyan-300">
                        已自定义
                      </span>
                    )}
                  </div>
                  {isCustomized && (
                    <button
                      className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
                      onClick={() => handleResetSingle(config.name)}
                      type="button"
                    >
                      重置
                    </button>
                  )}
                </div>

                <textarea
                  className="min-h-[180px] w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-cyan-500"
                  value={editedPrompt}
                  onChange={(event) =>
                    setEdits((prev) => ({
                      ...prev,
                      [config.name]: event.target.value,
                    }))
                  }
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950 p-5">
          <p className="text-sm text-zinc-400">
            共 {STYLE_CONFIGS.length} 个风格，已自定义 {customizedCount} 个
          </p>
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
              onClick={onClose}
              type="button"
            >
              取消
            </button>
            <button
              className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
              onClick={handleSave}
              type="button"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
