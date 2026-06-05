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
    <div className="flex w-full min-w-0 items-end gap-3 rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3.5 shadow-[0_-1px_0_0_rgba(255,255,255,0.05)_inset,0_16px_48px_-12px_rgba(0,0,0,0.7)]">
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
          className="shrink-0 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
          onClick={cancelGenerate}
          type="button"
        >
          停止
        </button>
      ) : (
        <button
          className="shrink-0 rounded-xl bg-zinc-100 px-5 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
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
