"use client";

import { StyleAvatar } from "@/components/style-avatar";
import { EXAMPLE_PROMPTS } from "@/lib/example-prompts";
import { STYLE_CONFIGS } from "@/lib/style-configs";
import { useToneSession } from "@/lib/tone-session";

const STYLE_COUNT = STYLE_CONFIGS.length;
const HOME_EXAMPLES = EXAMPLE_PROMPTS.slice(0, 8);

const SAMPLE_INPUT = "今天路上堵得厉害，可能会晚点到。";

type Tint = "amber" | "sky" | "emerald";

const VARIANTS: ReadonlyArray<{
  style: string;
  label: string;
  text: string;
  tint: Tint;
}> = [
  {
    style: "老板",
    label: "对老板",
    text: "路上有些拥堵，我预计会晚到约 15 分钟，到达后第一时间向您同步。",
    tint: "amber",
  },
  {
    style: "客户",
    label: "对客户",
    text: "抱歉让您久等，路上交通不太顺畅，我会尽快赶到，感谢您的耐心。",
    tint: "sky",
  },
  {
    style: "朋友",
    label: "对朋友",
    text: "堵麻了，可能要晚点到，你先坐，到了喊你！",
    tint: "emerald",
  },
];

const TINT: Record<
  Tint,
  { card: string; halo: string; label: string; accent: string }
> = {
  amber: {
    card: "border-amber-400/25 bg-gradient-to-br from-amber-500/[0.12] via-orange-500/[0.06] to-transparent hover:border-amber-400/50",
    halo: "bg-amber-400/20",
    label: "text-amber-300",
    accent: "from-amber-400 to-orange-400",
  },
  sky: {
    card: "border-sky-400/25 bg-gradient-to-br from-sky-500/[0.12] via-cyan-500/[0.06] to-transparent hover:border-sky-400/50",
    halo: "bg-sky-400/20",
    label: "text-sky-300",
    accent: "from-sky-400 to-cyan-400",
  },
  emerald: {
    card: "border-emerald-400/25 bg-gradient-to-br from-emerald-500/[0.12] via-teal-500/[0.06] to-transparent hover:border-emerald-400/50",
    halo: "bg-emerald-400/20",
    label: "text-emerald-300",
    accent: "from-emerald-400 to-teal-400",
  },
};

const TAG_COLOR: Record<string, string> = {
  文学: "bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/30",
  日常: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30",
  职场: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30",
  生活: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30",
  会议: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30",
  协作: "bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-400/30",
  思考: "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/30",
  直播: "bg-orange-500/15 text-orange-300 ring-1 ring-orange-400/30",
};

const TAG_DEFAULT =
  "bg-zinc-700/40 text-zinc-300 ring-1 ring-zinc-500/30";

function ExampleCard({
  tag,
  text,
  onPick,
}: {
  tag: string;
  text: string;
  onPick: (prompt: string) => void;
}): React.JSX.Element {
  const tagStyle = TAG_COLOR[tag] ?? TAG_DEFAULT;
  return (
    <button
      className="group flex h-full min-w-0 flex-col rounded-xl border border-white/10 bg-zinc-900/60 p-4 text-left transition hover:border-white/25 hover:bg-zinc-900/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
      onClick={() => onPick(text)}
      type="button"
    >
      <span
        className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider ${tagStyle}`}
      >
        {tag}
      </span>
      <p className="mt-2.5 line-clamp-3 flex-1 text-[13px] leading-relaxed text-zinc-200 transition group-hover:text-white">
        {text}
      </p>
    </button>
  );
}

function ToneCard({
  style,
  label,
  text,
  tint,
}: {
  style: string;
  label: string;
  text: string;
  tint: Tint;
}): React.JSX.Element {
  const t = TINT[tint];
  return (
    <article
      className={`group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border p-4 shadow-[0_4px_24px_rgba(0,0,0,0.35)] transition ${t.card}`}
    >
      <div className={`absolute -top-12 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full blur-3xl ${t.halo}`} />
      <div className="relative mx-auto h-14 w-full max-w-[6.5rem] overflow-hidden">
        <StyleAvatar className="mx-auto" height={56} styleName={style} width={84} />
      </div>
      <p className={`relative mt-2 text-center text-[11px] font-semibold tracking-wider uppercase ${t.label}`}>
        {label}
      </p>
      <p className="relative mt-1.5 line-clamp-3 text-center text-[13px] leading-relaxed text-zinc-100">
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
      <header className="mb-9 min-w-0 text-center xl:mb-7 xl:text-left">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500/15 to-fuchsia-500/15 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-violet-200 ring-1 ring-violet-400/30 uppercase">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
          Tone Studio
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-[2rem]">
          <span className="bg-gradient-to-r from-white via-violet-100 to-fuchsia-200 bg-clip-text text-transparent">
            一句话，生成多种得体表达
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-7 text-zinc-300 xl:mx-0">
          输入原话，同时改写成不同对象、场景的版本。<span className="text-zinc-100">意思不变，语气更贴切。</span>
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 xl:justify-start">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-200 ring-1 ring-violet-400/25">
            <span className="text-violet-300">{STYLE_COUNT}</span> 种语气
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-200 ring-1 ring-emerald-400/25">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            流式输出
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800/80 px-2.5 py-1 text-xs text-zinc-300 ring-1 ring-zinc-600/40">
            <kbd className="font-mono text-[10px] text-zinc-100">⌘ Enter</kbd>
            发送
          </span>
        </div>
      </header>

      {/* 第一行：原话 + 三种语气横排（占满宽） */}
      <section
        aria-label="改写效果预览"
        className="grid min-w-0 grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <article className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/[0.18] via-fuchsia-500/[0.08] to-transparent p-4 shadow-[0_4px_24px_rgba(0,0,0,0.35)] sm:col-span-2 xl:col-span-1">
          <div className="absolute -top-16 -right-10 h-32 w-32 rounded-full bg-violet-500/25 blur-3xl" />
          <div className="relative flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.8)]" />
            <p className="text-[11px] font-semibold tracking-[0.18em] text-violet-200 uppercase">
              原话
            </p>
          </div>
          <p className="relative mt-3 flex-1 text-[15px] leading-relaxed text-white">
            {SAMPLE_INPUT}
          </p>
          <div className="relative mt-3 flex items-center gap-1.5 text-[11px] text-violet-300/80">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            改写为
          </div>
        </article>

        {VARIANTS.map((item) => (
          <ToneCard
            key={item.style}
            label={item.label}
            style={item.style}
            text={item.text}
            tint={item.tint}
          />
        ))}
      </section>

      {/* 第二行：示例全宽铺满 */}
      <section className="mt-10 min-w-0">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">试试这些示例</h2>
            <p className="mt-0.5 text-xs text-zinc-400">点击填入下方输入框，可编辑后发送</p>
          </div>
          <span className="hidden text-xs text-zinc-500 sm:block">
            {HOME_EXAMPLES.length} 条精选
          </span>
        </div>
        <div className="mt-4 grid min-w-0 grid-cols-2 gap-3">
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
