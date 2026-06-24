/** 卡片弹入：从下方缩放弹出 */
export const cardPop = {
  hidden: {
    opacity: 0,
    scale: 0.72,
    y: 28,
  },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 440,
      damping: 24,
      mass: 0.75,
    },
  },
};

/** 网格容器：用 staggerChildren 让 87 张卡形成波浪式渐入，无需手动 setTimeout */
export const resultsGridStagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.018,
      delayChildren: 0.04,
    },
  },
};
