"use client";

import { useRef } from "react";
import { useToneSession } from "@/lib/tone-session";
import { useAutogrowTextarea } from "@/lib/use-autogrow-textarea";
import { userInputSchema } from "@/lib/schemas";

export function InputDock(): React.JSX.Element {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { input, setInput, isLoading, startGenerate, cancelGenerate } = useToneSession();

  useAutogrowTextarea(inputRef, input);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void startGenerate();
    }
  };

  const canSubmit = userInputSchema.safeParse(input).success;

  return (
    <div className="group relative flex w-full min-w-0 items-end gap-3 rounded-2xl border border-violet-400/25 bg-zinc-900/75 px-4 py-3.5 shadow-[0_-1px_0_0_rgba(255,255,255,0.06)_inset,0_20px_60px_-20px_rgba(139,92,246,0.45)] backdrop-blur-xl transition-colors focus-within:border-violet-400/55 focus-within:bg-zinc-900/85 hover:border-violet-400/40">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 -top-px h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent opacity-60 transition group-focus-within:opacity-100"
      />
      <textarea
        ref={inputRef}
        data-tone-input
        rows={1}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入你要表达的话，按 Ctrl/Cmd + Enter 发送"
        className="input-autogrow min-h-11 max-h-40 min-w-0 flex-1 bg-transparent text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-500"
      />

      {isLoading ? (
        <button
          className="shrink-0 rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:border-amber-400/70 hover:bg-amber-500/25 hover:text-amber-100"
          onClick={cancelGenerate}
          type="button"
        >
          停止
        </button>
      ) : (
        <button
          className="shrink-0 rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_18px_rgba(167,139,250,0.45)] transition hover:from-violet-400 hover:via-fuchsia-400 hover:to-pink-400 hover:shadow-[0_6px_22px_rgba(167,139,250,0.6)] disabled:cursor-not-allowed disabled:bg-none disabled:bg-zinc-700/80 disabled:text-zinc-400 disabled:shadow-none"
          disabled={!canSubmit}
          onClick={() => {
            void startGenerate();
          }}
          type="button"
        >
          发送
        </button>
      )}
    </div>
  );
}
