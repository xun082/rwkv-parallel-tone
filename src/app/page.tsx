"use client";

import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAutogrowTextarea } from "@/lib/use-autogrow-textarea";
import { STYLE_CONFIGS, type StyleConfig } from "@/lib/style-configs";
import {
  getApiSettingsPayload,
  loadApiSettings,
  resetApiSettings,
  saveApiSettings,
  type ApiSettings,
} from "@/lib/api-settings-store";
import {
  apiSettingsSchema,
  formatZodError,
  userInputSchema,
} from "@/lib/schemas";
import {
  GenerateRequestError,
  runBatchGenerate,
} from "@/lib/generate-client";
import {
  getMergedStyleConfigs,
  resetCustomPrompts,
  saveCustomPrompts,
} from "@/lib/prompt-store";

interface GeneratedResult {
  index: number;
  style: string;
  content: string;
  isComplete: boolean;
  color: string;
  icon: string;
}

const EXAMPLE_PROMPTS = [
  "燕子去了，有再来的时候；杨柳枯了，有再青的时候；桃花谢了，有再开的时候。但是，聪明的，你告诉我，我们的日子为什么一去不复返呢？——是有人偷了他们罢：那是谁？又藏在何处呢？是他们自己逃走了罢：现在又到了哪里呢？",
  "今天路上堵得厉害，我明明说过会按时到，却在第二个路口就被困住。手机屏幕不断亮起又熄灭，时间一分一秒过去，我只能先发消息：你先等等，等我到了再说清楚。",
  "这个方案我不是简单地不同意，而是看见了它在关键环节上的漏洞：预算不够、流程绕弯、风险预案缺失。与其让大家被动补救，不如现在就停下来，把底层逻辑重新捋一遍，再决定下一步要怎么走。",
  "需求的骨架已经搭起来，但越往后走越发现细节与口径对不上：页面要的文案节奏、接口返回的字段、以及权限规则都在彼此打架。今天晚上我们要把最后的分歧拆清楚，给出可落地的最终版本，而不是留到明天再返工。",
  "这周末我想约你吃饭，不只是为了聚一聚。想听你聊聊最近的节奏，也想把我这段时间的计划讲明白：哪些事值得坚持，哪些事要学会放下，别让误会和拖延继续堆积。",
  "明天下午三点做一次项目复盘吧：把我们做对的地方记下来，也把踩过的坑讲透。尤其是上线前的校验和数据口径，我们要把它们对齐到同一种定义，免得下一次又在同一个地方摔跤。",
  "我已经到酒店了，窗外的灯光很亮，可我还是先把手机放到一边。今天的奔波让我有点疲惫，但我会很快恢复；你那边如果还在忙，就按你的节奏来，等我休息好了再联系。",
  "欢迎新来的朋友，先别急着把所有任务都背下来。先跟着我们跑一遍流程：看清楚输入从哪里来、输出要到哪里去、遇到异常时该找谁。只要你愿意提问，节奏就不会太难。",
  "本次活动今天正式启动。我们先从一句话开始：把目标说清楚，把规则写明白，也把彼此尊重放在最前面。接下来几天如果有临时变动，请你相信我们会提前沟通并给出替代方案。",
  "你有没有发现，越是重要的决定越容易拖到最后一刻。可真正的勇气不是把事情推到明天，而是此刻把担心讲出来、把需要的支持说清楚，然后朝着更确定的方向走一步，再走下一步。",
];

function cn(...classes: Array<string | null | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

function buildInitialResults(configs: StyleConfig[]): GeneratedResult[] {
  return configs.map((config, index) => ({
    index,
    style: config.name,
    content: "",
    isComplete: false,
    color: config.color,
    icon: config.icon,
  }));
}

function getResultPlaceholder(result: GeneratedResult): string {
  if (!result.isComplete) {
    return "生成中...";
  }
  return "未返回内容";
}

interface PromptEditorProps {
  onClose: () => void;
  onSaved: () => void;
}

function PromptEditor({ onClose, onSaved }: PromptEditorProps): React.JSX.Element {
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
              留空则使用 <code className="rounded bg-zinc-800 px-1 text-zinc-300">.env.local</code>{" "}
              中的 <code className="rounded bg-zinc-800 px-1 text-zinc-300">RWKV_API_URL</code> /{" "}
              <code className="rounded bg-zinc-800 px-1 text-zinc-300">RWKV_PASSWORD</code>。
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
                  placeholder="留空则使用 RWKV_API_URL"
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
                    <span className="text-2xl">{config.icon}</span>
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

interface ResultCardProps {
  result: GeneratedResult;
  copiedIndex: number | null;
  onCopy: (index: number, content: string) => void;
}

const ResultCard = memo(function ResultCard({
  result,
  copiedIndex,
  onCopy,
}: ResultCardProps): React.JSX.Element {
  const isGenerating = !result.isComplete;
  const hasContent = result.content.length > 0;

  return (
    <article className="group flex h-[200px] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:border-cyan-500/50 hover:shadow-xl">
      <div className={cn("h-1.5 shrink-0 bg-linear-to-r", result.color)} />

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <header className="mb-3 flex shrink-0 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-2xl">{result.icon}</span>
            <span
              className={cn(
                "truncate rounded-full bg-linear-to-r px-3 py-1 text-xs font-semibold text-white",
                result.color,
              )}
            >
              {result.style}
            </span>
            {isGenerating && (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                生成中
              </span>
            )}
          </div>
          <button
            className="shrink-0 rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!hasContent}
            onClick={() => onCopy(result.index, result.content)}
            type="button"
          >
            {copiedIndex === result.index ? "已复制" : "复制"}
          </button>
        </header>

        <div className="tone-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <p
            className={cn(
              "whitespace-pre-wrap wrap-break-word text-sm leading-6",
              hasContent ? "text-zinc-200" : "text-zinc-500",
            )}
          >
            {hasContent ? result.content : getResultPlaceholder(result)}
          </p>
        </div>
      </div>
    </article>
  );
});

export default function Home(): React.JSX.Element {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isPromptEditorOpen, setPromptEditorOpen] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputDockRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useAutogrowTextarea(inputRef, input);

  useLayoutEffect(() => {
    const dock = inputDockRef.current;
    if (!dock) {
      return;
    }
    document.documentElement.style.setProperty(
      "--input-dock-height",
      `${dock.offsetHeight}px`,
    );
  }, [input, isLoading]);

  const handleGenerate = async () => {
    if (isLoading) {
      return;
    }

    const inputResult = userInputSchema.safeParse(input);
    if (!inputResult.success) {
      setGenerateError(formatZodError(inputResult.error));
      return;
    }

    const mergedConfigs = getMergedStyleConfigs();
    const initialResults = buildInitialResults(mergedConfigs);
    setResults(initialResults);
    setCopiedIndex(null);
    setGenerateError(null);
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const { filledCount, total } = await runBatchGenerate({
        userInput: inputResult.data,
        styles: mergedConfigs,
        apiPayload: getApiSettingsPayload(),
        signal: abortController.signal,
        initialResults,
        onResults: setResults,
      });

      if (filledCount === 0) {
        setGenerateError(
          "上游已响应，但所有风格均未返回文本。请检查密码、模板或稍后重试。",
        );
      } else if (filledCount < total) {
        setGenerateError(
          `部分风格未返回内容（${filledCount}/${total}）。可尝试缩短输入后重试。`,
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      const message =
        error instanceof GenerateRequestError
          ? error.message
          : error instanceof Error
            ? error.message
            : "生成失败";
      setGenerateError(message);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      inputRef.current?.focus();
    }
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setGenerateError(null);
  };

  const handleCopy = useCallback(async (index: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      alert("复制失败，请重试");
    }
  }, []);

  const handlePromptSaved = () => {};

  const handleInputKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === "Enter" && !event.shiftKey && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void handleGenerate();
    }
  };

  const completedCount = useMemo(
    () => results.filter((result) => result.isComplete).length,
    [results],
  );

  const handleUseExamplePrompt = (prompt: string) => {
    setInput(prompt);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(prompt.length, prompt.length);
    });
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100">

      <button
        className="fixed right-6 top-6 z-40 rounded-2xl border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-sm font-semibold text-zinc-100 shadow-lg backdrop-blur transition hover:scale-105 hover:bg-zinc-800"
        onClick={() => setPromptEditorOpen(true)}
        type="button"
      >
        模板设置
      </button>

      {isPromptEditorOpen && (
        <PromptEditor
          onClose={() => setPromptEditorOpen(false)}
          onSaved={handlePromptSaved}
        />
      )}

      <main className="w-full px-4 pt-6 pb-[calc(var(--input-dock-height,7rem)+1.5rem)]">
        {results.length === 0 && (
          <section className="relative z-20 mx-auto mt-[12vh] w-full max-w-4xl">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-zinc-100">示例输入</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  直接输入你想表达的原话即可，点击示例可一键填入，再按{" "}
                  <span className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-200">
                    Ctrl/Cmd + Enter
                  </span>{" "}
                  发送。
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {EXAMPLE_PROMPTS.map((prompt, index) => (
                  <button
                    key={`${index}-${prompt}`}
                    className="rounded-2xl border border-zinc-700 bg-zinc-950/80 px-4 py-3 text-left text-sm text-zinc-200 transition hover:border-cyan-500/60 hover:bg-zinc-900"
                    onClick={() => handleUseExamplePrompt(prompt)}
                    type="button"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {generateError && (
          <div className="relative z-30 mx-auto mb-4 max-w-3xl rounded-2xl border border-amber-500/40 bg-amber-950/80 px-4 py-3 text-sm text-amber-100">
            {generateError}
          </div>
        )}

        {results.length > 0 && (
          <section className="relative z-20">
            {isLoading && (
              <div className="sticky top-4 z-30 mb-4 flex items-center justify-center">
                <div className="inline-flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900/95 px-5 py-2.5 text-sm shadow-lg backdrop-blur">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-cyan-400" />
                  <span className="text-zinc-200">
                    正在并发生成 {results.length} 种语气
                    {completedCount > 0 &&
                      ` · 已完成 ${completedCount}/${results.length}`}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
              {results.map((result) => (
                <ResultCard
                  key={result.index}
                  result={result}
                  copiedIndex={copiedIndex}
                  onCopy={handleCopy}
                />
              ))}
            </div>
          </section>
        )}

      </main>

      <div
        ref={inputDockRef}
        className="fixed bottom-6 left-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2"
      >
        <div className="flex items-end gap-3 rounded-3xl border border-zinc-700 bg-zinc-900/95 px-4 py-3 shadow-xl backdrop-blur-xl">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="输入你要表达的话，按 Ctrl/Cmd + Enter 发送"
            className="input-autogrow min-h-14 max-h-80 flex-1 bg-transparent text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-500"
          />

          {isLoading ? (
            <button
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
              onClick={handleCancel}
              type="button"
            >
              停止
            </button>
          ) : (
            <button
              className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
              disabled={!userInputSchema.safeParse(input).success}
              onClick={() => {
                void handleGenerate();
              }}
              type="button"
            >
              并发生成
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
