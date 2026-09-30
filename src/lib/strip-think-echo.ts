/**
 * 提示词停在 `Assistant: <think></think`，少了闭合的 `>`。
 * 模型会先把这个符号补上，少数风格还会接着空转 `<think></think>`。
 * 只剥掉每条结果开头的这一段，正文里的内容保持原样。
 */

const OPEN = "<think>";
const CLOSE = "</think>";

export class ThinkEchoPeeler {
  private pending = "";
  private done = false;

  push(delta: string): string {
    if (this.done) {
      return delta;
    }
    if (!delta) {
      return "";
    }
    this.pending += delta;
    return this.pull(false);
  }

  finish(): string {
    if (this.done) {
      return "";
    }
    return this.pull(true);
  }

  private pull(eof: boolean): string {
    const text = this.pending;
    let i = 0;

    while (i < text.length) {
      const ch = text[i] ?? "";
      if (ch === ">" || /\s/.test(ch)) {
        i += 1;
        continue;
      }

      if (text.startsWith(OPEN, i)) {
        const closeAt = text.indexOf(CLOSE, i + OPEN.length);
        if (closeAt === -1) {
          if (!eof) {
            this.pending = text.slice(i);
            return "";
          }
          const inner = text.slice(i + OPEN.length).replace(/<\/?think>/g, "");
          this.complete();
          return inner.replace(/^[>\s]+/, "");
        }

        const inner = text.slice(i + OPEN.length, closeAt);
        const rest = text.slice(closeAt + CLOSE.length);
        const restHasAnswer = /[^\s>]/.test(rest.replace(/<\/?think>/g, ""));
        if (!restHasAnswer && inner.trim()) {
          this.complete();
          return inner.replace(/^[>\s]+/, "");
        }
        i = closeAt + CLOSE.length;
        continue;
      }

      const tail = text.slice(i);
      if (OPEN.startsWith(tail) && tail.length < OPEN.length) {
        if (!eof) {
          this.pending = tail;
          return "";
        }
        this.complete();
        return tail;
      }

      this.complete();
      return text.slice(i);
    }

    this.pending = "";
    if (eof) {
      this.complete();
    }
    return "";
  }

  private complete(): void {
    this.done = true;
    this.pending = "";
  }
}
