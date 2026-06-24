"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { InputDock } from "@/components/input-dock";
import { PromptEditor } from "@/components/prompt-editor";
import { ToneSessionProvider } from "@/lib/tone-session";

function cn(...classes: Array<string | null | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

function AppChrome({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const [isPromptEditorOpen, setPromptEditorOpen] = useState(false);

  const isChat = pathname.startsWith("/chat");
  const isHome = pathname === "/";

  return (
    <div className="tone-app-canvas relative flex h-dvh min-w-0 flex-col overflow-hidden text-zinc-100">
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-4 px-4 sm:px-6">
        <div
          aria-hidden
          className="tone-rule-top pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-90"
        />
        <div className="flex items-center gap-4">
          <Link
            className="bg-gradient-to-r from-white via-violet-100 to-fuchsia-200 bg-clip-text text-[15px] font-bold tracking-tight text-transparent transition hover:from-violet-200 hover:to-fuchsia-300"
            href="/"
          >
            Tone
          </Link>
          {isChat && (
            <Link
              className="text-sm text-zinc-400 transition hover:text-violet-200"
              href="/"
            >
              首页
            </Link>
          )}
        </div>

        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-3.5 py-1.5 text-sm font-medium text-violet-100 transition hover:border-violet-400/60 hover:bg-violet-500/20 hover:text-white"
          onClick={() => setPromptEditorOpen(true)}
          type="button"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_6px_rgba(196,181,253,0.9)]" />
          模板设置
        </button>
      </header>

      <main
        className={cn(
          "tone-scrollbar min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto",
          isHome && "tone-home-canvas",
          isChat && "tone-chat-canvas",
        )}
      >
        <div
          className={cn(
            "w-full min-w-0 py-5 sm:py-7",
            isChat && "px-3 sm:px-5 lg:px-6",
            isHome && "mx-auto w-full max-w-7xl px-4 pt-1 sm:px-6 sm:pt-3 lg:px-10",
            !isChat && !isHome && "mx-auto max-w-3xl px-4",
          )}
        >
          {children}
        </div>
      </main>

      <footer className="relative min-w-0 shrink-0 px-4 py-5 sm:px-6">
        <div
          aria-hidden
          className="tone-rule-top pointer-events-none absolute inset-x-0 top-0 h-px opacity-90"
        />
        <div
          className={cn(
            "mx-auto w-full min-w-0",
            isHome ? "max-w-7xl" : "max-w-2xl",
          )}
        >
          <InputDock />
        </div>
      </footer>

      {isPromptEditorOpen && (
        <PromptEditor
          onClose={() => setPromptEditorOpen(false)}
          onSaved={() => setPromptEditorOpen(false)}
        />
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <ToneSessionProvider>
      <AppChrome>{children}</AppChrome>
    </ToneSessionProvider>
  );
}
