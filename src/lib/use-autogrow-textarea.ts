import { useLayoutEffect, type RefObject } from "react";

const MIN_HEIGHT_PX = 56;
const MAX_HEIGHT_PX = 320;

export function useAutogrowTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    el.style.height = "0px";
    const nextHeight = Math.min(
      Math.max(el.scrollHeight, MIN_HEIGHT_PX),
      MAX_HEIGHT_PX,
    );
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? "auto" : "hidden";
  }, [ref, value]);
}
