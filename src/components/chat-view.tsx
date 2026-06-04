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
          animate={{ opacity: [0.4, 1, 0.4], scale: [0.92, 1, 0.92] }}
          className="h-9 w-9 rounded-full border-2 border-zinc-800 border-t-zinc-400"
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
              animate={{ opacity: [0.55, 1, 0.55] }}
              className="rounded-full bg-zinc-900/80 px-4 py-1.5 text-xs text-zinc-500 backdrop-blur-sm"
              transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
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
