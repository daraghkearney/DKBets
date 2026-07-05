"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Odds & Arbs", icon: "◎" },
  { href: "/builder", label: "Bet Builder", icon: "◈" },
  { href: "/stats", label: "Player Stats", icon: "▤" },
  { href: "/matches", label: "Matchups", icon: "⚔" },
];

export default function NavBar() {
  const path = usePathname();

  return (
    <nav className="border-b border-edge bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 sm:px-6">
        {LINKS.map((l) => {
          const active =
            l.href === "/"
              ? path === "/"
              : path === l.href || path.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`relative shrink-0 px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <span className="mr-1.5 opacity-70">{l.icon}</span>
              {l.label}
              {active && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
