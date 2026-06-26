export interface StreamChoice {
  index?: number;
  delta?: {
    content?: string;
  };
}

export interface StreamResultSlice {
  index: number;
  style: string;
  content: string;
  isComplete: boolean;
}

export function applyStreamChoices<T extends StreamResultSlice>(
  results: T[],
  choices: StreamChoice[],
): T[] {
  const next = [...results];

  for (const choice of choices) {
    const index = typeof choice.index === "number" ? choice.index : -1;
    const deltaContent = choice.delta?.content ?? "";
    if (!deltaContent || index < 0 || index >= next.length) {
      continue;
    }

    next[index] = {
      ...next[index],
      content: next[index].content + deltaContent,
    };
  }

  return next;
}

export function markAllComplete<T extends StreamResultSlice>(results: T[]): T[] {
  return results.map((result) => ({ ...result, isComplete: true }));
}

export async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  onChoices: (choices: StreamChoice[]) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data: ")) {
          continue;
        }

        const payload = line.slice(6);
        if (payload === "[DONE]") {
          continue;
        }

        try {
          const parsed = JSON.parse(payload) as { choices?: StreamChoice[] };
          if (Array.isArray(parsed.choices) && parsed.choices.length > 0) {
            onChoices(parsed.choices);
          }
        } catch {
          // 忽略偶发的非 JSON 行
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
