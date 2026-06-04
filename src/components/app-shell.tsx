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
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            className="text-[15px] font-semibold tracking-tight text-zinc-100 hover:text-white"
            href="/"
          >
            Tone
          </Link>
          {isChat && (
            <Link
              className="text-sm text-zinc-500 transition hover:text-zinc-300"
              href="/"
            >
              首页
            </Link>
          )}
        </div>

        <button
          className="rounded-full bg-zinc-900 px-3.5 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          onClick={() => setPromptEditorOpen(true)}
          type="button"
        >
          模板设置
        </button>
      </header>

      <main
        className={cn(
          "tone-scrollbar min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto",
          isHome ? "tone-home-canvas" : "bg-zinc-950",
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

      <footer className="min-w-0 shrink-0 px-4 py-5 sm:px-6">
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
