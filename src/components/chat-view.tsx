"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ToneResultCard } from "@/components/tone-result-card";
import {
  REVEAL_BATCH_SIZE,
  REVEAL_INTERVAL_MS,
} from "@/lib/motion-presets";
import { useToneSession } from "@/lib/tone-session";

export function ChatView(): React.JSX.Element {
  const { results, copiedIndex, copyResult, isLoading, generationId } =
    useToneSession();
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (results.length === 0) {
      setVisibleCount(0);
      return;
    }

    let cancelled = false;
    let count = 0;
    const total = results.length;

    const tick = () => {
      if (cancelled) {
        return;
      }
      count = Math.min(count + REVEAL_BATCH_SIZE, total);
      setVisibleCount(count);
      if (count < total) {
        window.setTimeout(tick, REVEAL_INTERVAL_MS);
      }
    };

    setVisibleCount(0);
    const startTimer = window.setTimeout(tick, REVEAL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
    };
  }, [generationId, results.length]);

  const visibleResults = results.slice(0, visibleCount);

  if (results.length === 0) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5], scale: [0.92, 1, 0.92] }}
          className="h-9 w-9 rounded-full border-2 border-violet-500/20 border-t-violet-300 shadow-[0_0_18px_rgba(139,92,246,0.35)]"
          transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />
      </div>
    );
  }

  return (
    <div className="tone-results-canvas w-full pb-4">
      <AnimatePresence>
        {isLoading && visibleCount < results.length && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex justify-center"
            exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
            initial={{ opacity: 0, y: -10 }}
            key="wave-hint"
          >
            <motion.span
              animate={{ opacity: [0.7, 1, 0.7] }}
              className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-gradient-to-r from-violet-500/15 to-fuchsia-500/15 px-4 py-1.5 text-xs text-violet-100 shadow-[0_4px_18px_-6px_rgba(139,92,246,0.5)] backdrop-blur-sm"
              transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300 shadow-[0_0_8px_rgba(196,181,253,0.9)]" />
              角色登场中 {visibleCount}/{results.length}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      <LayoutGroup id="tone-results">
        <motion.div
          className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]"
          layout
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {visibleResults.map((result) => (
              <ToneResultCard
                copiedIndex={copiedIndex}
                key={`${generationId}-${result.index}`}
                onCopy={copyResult}
                result={result}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>
    </div>
  );
}
