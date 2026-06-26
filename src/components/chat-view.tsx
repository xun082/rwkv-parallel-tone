"use client";

import { motion } from "framer-motion";
import { ToneResultCard } from "@/components/tone-result-card";
import { resultsGridStagger } from "@/lib/motion-presets";
import { useToneSession } from "@/lib/tone-session";

export function ChatView(): React.JSX.Element {
  const { results, copiedIndex, copyResult, generationId } = useToneSession();

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
      <motion.div
        animate="show"
        className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]"
        initial="hidden"
        key={generationId}
        variants={resultsGridStagger}
      >
        {results.map((result) => (
          <ToneResultCard
            copiedIndex={copiedIndex}
            key={`${generationId}-${result.index}`}
            onCopy={copyResult}
            result={result}
          />
        ))}
      </motion.div>
    </div>
  );
}
