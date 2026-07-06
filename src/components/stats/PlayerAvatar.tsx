"use client";

import Image from "next/image";
import { useState } from "react";
import { playerImageUrl } from "@/lib/fotmob/images";

export default function PlayerAvatar({
  playerId,
  name,
  size = 56,
}: {
  playerId: number;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  if (!playerId || failed) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full border border-edge bg-background/60 text-xs font-bold text-muted"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {initials || "?"}
      </div>
    );
  }

  return (
    <Image
      src={playerImageUrl(playerId)}
      alt=""
      width={size}
      height={size}
      unoptimized
      className="shrink-0 rounded-full border border-edge bg-background/60 object-cover"
      onError={() => setFailed(true)}
    />
  );
}
