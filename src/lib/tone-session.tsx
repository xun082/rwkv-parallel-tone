"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { getApiSettingsPayload } from "@/lib/api-settings-store";
import { GenerateRequestError, runBatchGenerate } from "@/lib/generate-client";
import { BLOCKED_INPUT_MESSAGE } from "@/lib/guard-messages";
import { getMergedStyleConfigs } from "@/lib/prompt-store";
import { formatZodError, userInputSchema } from "@/lib/schemas";
import { buildInitialResults, type ToneResult } from "@/lib/tone-types";

interface ToneSessionValue {
  input: string;
  setInput: (value: string) => void;
  userMessage: string;
  /** 每次发送递增，用于重置结果区弹入动画 */
  generationId: number;
  results: ToneResult[];
  isLoading: boolean;
  generateError: string | null;
  copiedIndex: number | null;
  completedCount: number;
  hasSession: boolean;
  startGenerate: () => Promise<void>;
  cancelGenerate: () => void;
  copyResult: (index: number, content: string) => Promise<void>;
  clearError: () => void;
}

const ToneSessionContext = createContext<ToneSessionValue | null>(null);

export function ToneSessionProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();

  const [input, setInput] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [results, setResults] = useState<ToneResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [generationId, setGenerationId] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  const completedCount = useMemo(
    () => results.filter((result) => result.isComplete).length,
    [results],
  );

  const hasSession = userMessage.length > 0 || results.length > 0;

  const clearError = useCallback(() => {
    setGenerateError(null);
  }, []);

  const cancelGenerate = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setGenerateError(null);
  }, []);

  const copyResult = useCallback(async (index: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      alert("复制失败，请重试");
    }
  }, []);

  const startGenerate = useCallback(async () => {
    if (isLoading) {
      return;
    }

    const inputResult = userInputSchema.safeParse(input);
    if (!inputResult.success) {
      setGenerateError(formatZodError(inputResult.error));
      return;
    }

    // 输入敏感词预检：只回传布尔值，词表留在服务端。预检不可用时放行，
    // 交由 /api/generate 兜底（命中会返回 422）。
    try {
      const screenResponse = await fetch("/api/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputResult.data }),
      });
      if (screenResponse.ok) {
        const { blocked } = (await screenResponse.json()) as { blocked?: boolean };
        if (blocked) {
          setGenerateError(BLOCKED_INPUT_MESSAGE);
          return;
        }
      }
    } catch {
      // 预检不可用：继续，交由服务端生成时兜底
    }

    const mergedConfigs = getMergedStyleConfigs();
    const initialResults = buildInitialResults(mergedConfigs);

    setUserMessage(inputResult.data);
    setResults(initialResults);
    setGenerationId((id) => id + 1);
    setCopiedIndex(null);
    setGenerateError(null);
    setIsLoading(true);

    if (pathname !== "/chat") {
      router.push("/chat");
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const { filledCount, total } = await runBatchGenerate({
        userInput: inputResult.data,
        styles: mergedConfigs,
        apiPayload: getApiSettingsPayload(),
        signal: abortController.signal,
        initialResults,
        onResults: setResults,
      });

      if (filledCount === 0) {
        setGenerateError(
          "上游已响应，但所有风格均未返回文本。请检查密码、模板或稍后重试。",
        );
      } else if (filledCount < total) {
        setGenerateError(
          `部分风格未返回内容（${filledCount}/${total}）。可尝试缩短输入后重试。`,
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      const message =
        error instanceof GenerateRequestError
          ? error.message
          : error instanceof Error
            ? error.message
            : "生成失败";
      setGenerateError(message);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, isLoading, pathname, router]);

  const value = useMemo<ToneSessionValue>(
    () => ({
      input,
      setInput,
      userMessage,
      generationId,
      results,
      isLoading,
      generateError,
      copiedIndex,
      completedCount,
      hasSession,
      startGenerate,
      cancelGenerate,
      copyResult,
      clearError,
    }),
    [
      input,
      userMessage,
      generationId,
      results,
      isLoading,
      generateError,
      copiedIndex,
      completedCount,
      hasSession,
      startGenerate,
      cancelGenerate,
      copyResult,
      clearError,
    ],
  );

  return (
    <ToneSessionContext.Provider value={value}>{children}</ToneSessionContext.Provider>
  );
}

export function useToneSession(): ToneSessionValue {
  const context = useContext(ToneSessionContext);
  if (!context) {
    throw new Error("useToneSession must be used within ToneSessionProvider");
  }
  return context;
}
