"use client";

import { StyleAvatar } from "@/components/style-avatar";
import { EXAMPLE_PROMPTS } from "@/lib/example-prompts";
import { STYLE_CONFIGS } from "@/lib/style-configs";
import { useToneSession } from "@/lib/tone-session";

const STYLE_COUNT = STYLE_CONFIGS.length;
const HOME_EXAMPLES = EXAMPLE_PROMPTS.slice(0, 8);

const SAMPLE_INPUT = "今天路上堵得厉害，可能会晚点到。";

const VARIANTS = [
  {
    style: "老板",
    label: "对老板",
    text: "路上有些拥堵，我预计会晚到约 15 分钟，到达后第一时间向您同步。",
  },
  {
    style: "客户",
    label: "对客户",
    text: "抱歉让您久等，路上交通不太顺畅，我会尽快赶到，感谢您的耐心。",
  },
  {
    style: "朋友",
    label: "对朋友",
    text: "堵麻了，可能要晚点到，你先坐，到了喊你！",
  },
] as const;

function ExampleCard({
  tag,
  text,
  onPick,
}: {
  tag: string;
  text: string;
  onPick: (prompt: string) => void;
}): React.JSX.Element {
  return (
    <button
      className="flex h-full min-w-0 flex-col rounded-xl border border-white/[0.06] bg-zinc-900/35 p-3.5 text-left transition hover:border-white/[0.12] hover:bg-zinc-900/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600"
      onClick={() => onPick(text)}
      type="button"
    >
      <span className="text-[10px] font-medium text-zinc-500">{tag}</span>
      <p className="mt-1.5 line-clamp-3 flex-1 text-[13px] leading-relaxed text-zinc-400">
        {text}
      </p>
    </button>
  );
}

function ToneCard({
  style,
  label,
  text,
}: {
  style: string;
  label: string;
  text: string;
}): React.JSX.Element {
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/35 p-3">
      <div className="mx-auto h-14 w-full max-w-[6.5rem] overflow-hidden">
        <StyleAvatar className="mx-auto" height={56} styleName={style} width={84} />
      </div>
      <p className="mt-1.5 text-center text-[11px] text-zinc-500">{label}</p>
      <p className="mt-1 line-clamp-3 text-center text-xs leading-relaxed text-zinc-300">
        {text}
      </p>
    </article>
  );
}

export default function HomePage(): React.JSX.Element {
  const { setInput } = useToneSession();

  const fillExample = (prompt: string) => {
    setInput(prompt);
    window.requestAnimationFrame(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        "[data-tone-input]",
      );
      textarea?.focus();
      textarea?.setSelectionRange(prompt.length, prompt.length);
    });
  };

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden pb-2">
      <header className="mb-8 min-w-0 text-center xl:mb-6 xl:text-left">
        <p className="text-xs font-medium tracking-[0.2em] text-zinc-500 uppercase">
          Tone Studio
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
          一句话，生成多种得体表达
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-400 xl:mx-0">
          输入原话，同时改写成不同对象、场景的版本。意思不变，语气更贴切。
        </p>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-zinc-500 xl:justify-start">
          <span>{STYLE_COUNT} 种语气</span>
          <span className="text-zinc-700">·</span>
          <span>流式输出</span>
          <span className="text-zinc-700">·</span>
          <kbd className="rounded border border-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            ⌘ Enter
          </kbd>
        </p>
      </header>

      {/* 第一行：原话 + 三种语气横排（占满宽） */}
      <section
        aria-label="改写效果预览"
        className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <article className="flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-zinc-900/50 p-3.5 sm:col-span-2 xl:col-span-1">
          <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">原话</p>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-200">{SAMPLE_INPUT}</p>
        </article>

        {VARIANTS.map((item) => (
          <ToneCard key={item.style} label={item.label} style={item.style} text={item.text} />
        ))}
      </section>

      {/* 第二行：示例全宽铺满，避免右侧空洞 */}
      <section className="mt-8 min-w-0">
        <h2 className="text-sm font-medium text-zinc-300">试试这些示例</h2>
        <p className="mt-0.5 text-xs text-zinc-600">点击填入下方输入框，可编辑后发送</p>
        <div className="mt-3 grid min-w-0 grid-cols-2 gap-3">
          {HOME_EXAMPLES.map((item) => (
            <ExampleCard
              key={`${item.tag}-${item.text.slice(0, 8)}`}
              onPick={fillExample}
              tag={item.tag}
              text={item.text}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
