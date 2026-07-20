"use client";

import Image from "next/image";
import { useState } from "react";
import { teamImageUrl } from "@/lib/fotmob/images";

export default function TeamCrest({
  teamId,
  name,
  size = 28,
}: {
  teamId: number;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (!teamId || failed) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full border border-edge bg-surface-2 text-[10px] font-bold text-muted"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {initial}
      </div>
    );
  }

  return (
    <Image
      src={teamImageUrl(teamId)}
      alt=""
      width={size}
      height={size}
      unoptimized
      className="shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  );
}
