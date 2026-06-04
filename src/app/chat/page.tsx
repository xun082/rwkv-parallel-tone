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
      <p className="grid min-h-[30vh] place-items-center text-sm text-zinc-500">
        正在返回首页…
      </p>
    );
  }

  return (
    <div className="w-full">
      {generateError && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-950/80 px-3 py-2.5 text-sm text-amber-100">
          {generateError}
        </div>
      )}

      <ChatView />

      <p className="mt-8 text-center">
        <Link
          className="text-xs text-zinc-600 transition hover:text-zinc-400"
          href="/"
        >
          ← 返回首页
        </Link>
      </p>
    </div>
  );
}
