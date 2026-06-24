"use client";

import Image from "next/image";
import { useState } from "react";
import { getStyleAvatarUrl } from "@/lib/style-avatars";

function cn(...classes: Array<string | null | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

interface StyleAvatarProps {
  styleName: string;
  avatarUrl?: string;
  /** 双人插画宽度（PNG 为一对角色，需横向完整展示） */
  width?: number;
  height?: number;
  className?: string;
  preload?: boolean;
  /** 是否在首屏立即加载（用于首页等少量、可视的头像）；其余一律 lazy */
  eager?: boolean;
}

export function StyleAvatar({
  styleName,
  avatarUrl,
  width = 120,
  height = 78,
  className,
  preload = false,
  eager = false,
}: StyleAvatarProps): React.JSX.Element {
  const src = avatarUrl ?? getStyleAvatarUrl(styleName);
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className={cn(
        "relative flex max-w-full shrink-0 items-end justify-center overflow-hidden",
        className,
      )}
      style={{ width, height }}
    >
      {/* 占位：未加载时显示柔和的渐变 + shimmer，瞬间出现，避免空白卡片 */}
      <div
        aria-hidden
        className={cn(
          "tone-avatar-skeleton pointer-events-none absolute inset-0 rounded-xl transition-opacity duration-500 ease-out",
          loaded ? "opacity-0" : "opacity-100",
        )}
      />
      <Image
        alt={`${styleName}（双人）`}
        className={cn(
          "relative h-full w-full object-contain object-bottom drop-shadow-[0_10px_28px_rgba(0,0,0,0.55)] transition-opacity duration-500 ease-out",
          loaded ? "opacity-100" : "opacity-0",
        )}
        height={height}
        loading={eager || preload ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
        preload={preload}
        quality={70}
        sizes={`${width}px`}
        src={src}
        width={width}
      />
    </div>
  );
}
