import {
  applyStreamChoices,
  consumeSseStream,
  markAllComplete,
  type StreamResultSlice,
} from "@/lib/rwkv-stream";
import { type StyleConfig } from "@/lib/style-configs";

export interface ApiErrorPayload {
  code?: string;
  error?: string;
  detail?: string;
  api?: string;
}

export class GenerateRequestError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, init?: { status?: number; code?: string }) {
    super(message);
    this.name = "GenerateRequestError";
    this.status = init?.status;
    this.code = init?.code;
  }
}

async function parseApiError(response: Response): Promise<GenerateRequestError> {
  const fallback = new GenerateRequestError(`请求失败：${response.status}`, {
    status: response.status,
  });

  try {
    const payload = (await response.json()) as ApiErrorPayload;
    const message = payload.detail
      ? `${payload.error ?? fallback.message}\n${payload.detail}`
      : payload.error;
    return new GenerateRequestError(message || fallback.message, {
      status: response.status,
      code: payload.code,
    });
  } catch {
    const text = await response.text().catch(() => "");
    return text
      ? new GenerateRequestError(text, { status: response.status })
      : fallback;
  }
}

export async function runBatchGenerate<T extends StreamResultSlice>(options: {
  userInput: string;
  styles: StyleConfig[];
  apiPayload?: { apiUrl?: string; password?: string };
  signal?: AbortSignal;
  onResults: (results: T[]) => void;
  initialResults: T[];
}): Promise<{ filledCount: number; total: number }> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userInput: options.userInput,
      styles: options.styles,
      ...options.apiPayload,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  if (!response.body) {
    throw new GenerateRequestError("无法读取响应流");
  }

  let snapshot = options.initialResults;

  await consumeSseStream(response.body, (choices) => {
    snapshot = applyStreamChoices(snapshot, choices);
    options.onResults(snapshot);
  });

  snapshot = markAllComplete(snapshot);
  options.onResults(snapshot);

  const filledCount = snapshot.filter((item) => item.content.length > 0).length;
  return { filledCount, total: snapshot.length };
}
