"use client";

import Image from "next/image";
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
  priority?: boolean;
}

export function StyleAvatar({
  styleName,
  avatarUrl,
  width = 120,
  height = 78,
  className,
  priority = false,
}: StyleAvatarProps): React.JSX.Element {
  const src = avatarUrl ?? getStyleAvatarUrl(styleName);

  return (
    <div
      className={cn(
        "relative flex max-w-full shrink-0 items-end justify-center overflow-hidden",
        className,
      )}
      style={{ width, height }}
    >
      <Image
        alt={`${styleName}（双人）`}
        className="h-full w-full object-contain object-bottom drop-shadow-[0_10px_28px_rgba(0,0,0,0.55)]"
        height={height}
        priority={priority}
        src={src}
        unoptimized
        width={width}
      />
    </div>
  );
}
