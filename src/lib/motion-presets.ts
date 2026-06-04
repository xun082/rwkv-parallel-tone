/** 卡片弹入：从下方缩放弹出 */
export const cardPop = {
  hidden: {
    opacity: 0,
    scale: 0.62,
    y: 36,
    filter: "blur(6px)",
  },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      type: "spring" as const,
      stiffness: 440,
      damping: 24,
      mass: 0.75,
    },
  },
};

export const avatarPop = {
  hidden: { opacity: 0, scale: 0.45, y: 12 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 520,
      damping: 22,
      delay: 0.04,
    },
  },
};

/** 每批露出几张卡片（wave） */
export const REVEAL_BATCH_SIZE = 3;
export const REVEAL_INTERVAL_MS = 36;
