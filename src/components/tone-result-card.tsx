"use client";

import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StyleAvatar } from "@/components/style-avatar";
import { avatarPop, cardPop } from "@/lib/motion-presets";
import type { ToneResult } from "@/lib/tone-types";

function cn(...classes: Array<string | null | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

export function resultDomId(index: number): string {
  return `tone-result-${index}`;
}

interface ToneResultCardProps {
  result: ToneResult;
  copiedIndex: number | null;
  onCopy: (index: number, content: string) => void;
}

export const ToneResultCard = memo(function ToneResultCard({
  result,
  copiedIndex,
  onCopy,
}: ToneResultCardProps): React.JSX.Element {
  const hasContent = result.content.length > 0;
  const isWaiting = !hasContent && !result.isComplete;
  const isStreaming = hasContent && !result.isComplete;
  const isCopied = copiedIndex === result.index;
  const showBody = hasContent || result.isComplete;

  return (
    <motion.article
      animate="show"
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl",
        "bg-zinc-900/55 shadow-[0_12px_36px_-16px_rgba(0,0,0,0.7)]",
        "transition-[background-color] duration-300",
        "hover:bg-zinc-900/75",
        isStreaming && "bg-zinc-900/70",
      )}
      exit={{
        opacity: 0,
        scale: 0.88,
        transition: { duration: 0.18, ease: "easeIn" },
      }}
      id={resultDomId(result.index)}
      initial="hidden"
      layout
      transition={{
        layout: { type: "spring", stiffness: 380, damping: 28 },
      }}
      variants={cardPop}
    >
      <div className="relative flex flex-col items-center px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-8 h-28 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.07),transparent_70%)]"
        />

        <motion.div
          animate="show"
          className="relative z-10"
          initial="hidden"
          variants={avatarPop}
        >
          <motion.div
            animate={isWaiting ? { y: [0, -5, 0] } : { y: 0 }}
            transition={
              isWaiting
                ? { duration: 2.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
                : { type: "spring", stiffness: 400, damping: 28 }
            }
          >
            <StyleAvatar
              avatarUrl={result.avatarUrl}
              height={100}
              priority={result.index < 12}
              styleName={result.style}
              width={168}
            />
          </motion.div>
        </motion.div>

        <motion.p
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 mt-2 max-w-full px-1 text-center text-sm font-medium text-zinc-200"
          initial={{ opacity: 0, y: 6 }}
          transition={{ delay: 0.08, duration: 0.25, ease: "easeOut" }}
        >
          {result.style}
        </motion.p>
        {isWaiting && (
          <motion.p
            animate={{ opacity: [0.35, 0.75, 0.35] }}
            className="mt-0.5 text-[10px] text-zinc-600"
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          >
            等待生成…
          </motion.p>
        )}
        {isStreaming && (
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-500">
            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-zinc-400" />
            生成中
          </p>
        )}
      </div>

      <AnimatePresence initial={false}>
        {showBody && (
          <motion.div
            animate={{ opacity: 1, height: "auto" }}
            className="overflow-hidden"
            exit={{ opacity: 0, height: 0 }}
            initial={{ opacity: 0, height: 0 }}
            key="body"
            layout
            transition={{
              height: { type: "spring", stiffness: 320, damping: 30 },
              opacity: { duration: 0.22, ease: "easeOut" },
              layout: { type: "spring", stiffness: 360, damping: 30 },
            }}
          >
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="px-4 pb-4 pt-1 sm:px-5 sm:pb-5"
              initial={{ opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              {hasContent ? (
                <motion.p
                  animate={{ opacity: 1, scale: 1 }}
                  className="tone-scrollbar max-h-52 overflow-y-auto whitespace-pre-wrap text-[14px] leading-[1.75] text-zinc-200/92 sm:text-[15px]"
                  initial={{ opacity: 0, scale: 0.98 }}
                  layout
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                >
                  {result.content}
                  {isStreaming && (
                    <motion.span
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      aria-hidden
                      className="ml-0.5 inline-block h-[0.9em] w-px bg-zinc-400 align-middle"
                      transition={{ duration: 0.85, repeat: Number.POSITIVE_INFINITY }}
                    />
                  )}
                </motion.p>
              ) : (
                <p className="py-2 text-center text-[12px] text-zinc-600">暂无返回内容</p>
              )}

              {result.isComplete && hasContent && (
                <motion.button
                  className={cn(
                    "mt-2.5 text-[11px] transition",
                    isCopied
                      ? "text-zinc-300"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  onClick={() => onCopy(result.index, result.content)}
                  type="button"
                >
                  {isCopied ? "已复制" : "复制文案"}
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
});
