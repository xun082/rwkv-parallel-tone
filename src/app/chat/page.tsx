"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChatView } from "@/components/chat-view";
import { useToneSession } from "@/lib/tone-session";

export default function ChatPage(): React.JSX.Element {
  const router = useRouter();
  const { generateError, hasSession, isLoading, results } = useToneSession();

  const shouldShowChat = hasSession || isLoading || results.length > 0;

  useEffect(() => {
    if (!shouldShowChat) {
      router.replace("/");
    }
  }, [shouldShowChat, router]);

  if (!shouldShowChat) {
    return (
      <p className="grid min-h-[30vh] place-items-center text-sm text-zinc-400">
        正在返回首页…
      </p>
    );
  }

  return (
    <div className="w-full">
      {generateError && (
        <div className="mx-auto mb-5 flex max-w-3xl items-start gap-2.5 rounded-xl border border-rose-400/40 bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-orange-500/10 px-4 py-3 text-sm text-rose-100 shadow-[0_8px_24px_-12px_rgba(244,63,94,0.5)] backdrop-blur-sm">
          <span
            aria-hidden
            className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-400/25 text-[10px] font-bold text-rose-200"
          >
            !
          </span>
          <span className="leading-relaxed">{generateError}</span>
        </div>
      )}

      <ChatView />

      <p className="mt-10 text-center">
        <Link
          className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-zinc-900/40 px-3 py-1 text-xs text-zinc-400 backdrop-blur-sm transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-violet-200"
          href="/"
        >
          ← 返回首页
        </Link>
      </p>
    </div>
  );
}
