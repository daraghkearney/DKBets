"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { assetUrl } from "@/lib/basePath";
import { BRAND } from "@/lib/brand";
import { PRICING } from "@/lib/subscription/config";

const INTERVAL_MS = 5500;

const SLIDES = [
  {
    src: "/showcase/builder.png",
    alt: "Bet365 builder with odds targets and live leg hit-rates",
    tag: "Bet365 Builder",
    title: "Build to any odds target",
    description:
      "Highest-probability legs from live Bet365 prices — evens through 50/1, ranked by model hit-rate.",
    accent: "#22c55e",
    aspect: "aspect-[5/4] sm:aspect-[4/3]",
  },
  {
    src: "/showcase/star-player.png",
    alt: "Star player special with standout gem stat and combined probability",
    tag: "Star Player",
    title: "Standout gem specials",
    description:
      "Player props backed by tournament form, with combined-probability builders and one-click Bet365 links.",
    accent: "#fbbf24",
    aspect: "aspect-[4/5] sm:aspect-[3/4]",
  },
  {
    src: "/showcase/matchups.png",
    alt: "Positional duels with pitch overlay and pick of the day",
    tag: "Positional Duels",
    title: "1v1 tactical matchups",
    description:
      "Pitch overlays, career H2H history and pick-of-the-day props from positional duels.",
    accent: "#3b82f6",
    aspect: "aspect-[5/4] sm:aspect-[4/3]",
  },
] as const;

export default function ProShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const goTo = useCallback((index: number) => {
    setActive((index + SLIDES.length) % SLIDES.length);
    setProgress(0);
  }, []);

  useEffect(() => {
    if (paused) return;
    const tick = 50;
    const id = window.setInterval(() => {
      setProgress((p) => {
        const next = p + tick / INTERVAL_MS;
        if (next >= 1) {
          setActive((a) => (a + 1) % SLIDES.length);
          return 0;
        }
        return next;
      });
    }, tick);
    return () => window.clearInterval(id);
  }, [paused, active]);

  const slide = SLIDES[active];

  return (
    <div
      className="relative mx-auto w-full max-w-xl lg:max-w-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -inset-8 rounded-[3rem] opacity-60 blur-3xl transition-colors duration-700"
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 40%, ${slide.accent}22, transparent 70%)`,
        }}
      />

      <div className="showcase-float relative">
        {/* Feature label */}
        <div className="mb-4 flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors duration-500"
              style={{
                backgroundColor: `${slide.accent}18`,
                color: slide.accent,
              }}
            >
              {slide.tag}
            </span>
            <span className="hidden text-[11px] text-muted sm:inline">
              {BRAND.proName} preview
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show slide ${i + 1}`}
                aria-current={i === active ? "true" : undefined}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === active
                    ? "w-6 bg-accent"
                    : "w-1.5 bg-edge hover:bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Product frame */}
        <div className="showcase-frame overflow-hidden rounded-2xl border border-white/[0.08] bg-surface/90 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-sm">
          <div
            className={`relative w-full bg-background transition-[aspect-ratio] duration-500 ${slide.aspect}`}
          >
            {SLIDES.map((s, i) => (
              <div
                key={s.src}
                className={`absolute inset-0 transition-all duration-700 ease-out ${
                  i === active
                    ? "showcase-slide-active z-10 opacity-100"
                    : "z-0 opacity-0"
                }`}
                aria-hidden={i !== active}
              >
                <Image
                  src={assetUrl(s.src)}
                  alt={s.alt}
                  fill
                  priority={i === 0}
                  className="object-contain object-top"
                  sizes="(max-width: 1024px) 100vw, 560px"
                />
              </div>
            ))}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-12 bg-gradient-to-t from-background/80 to-transparent" />
          </div>

          {/* Progress bar */}
          <div className="h-0.5 bg-edge">
            <div
              className="h-full bg-accent transition-[width] duration-75 ease-linear"
              style={{ width: `${(paused ? progress : progress) * 100}%` }}
            />
          </div>
        </div>

        {/* Caption */}
        <div
          key={active}
          className="showcase-caption mt-5 rounded-2xl border border-edge/60 bg-surface/60 px-5 py-4 backdrop-blur-sm"
        >
          <h3 className="text-base font-bold tracking-tight">{slide.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {slide.description}
          </p>
        </div>

        {/* Nav arrows */}
        <button
          type="button"
          aria-label="Previous slide"
          onClick={() => goTo(active - 1)}
          className="absolute left-0 top-[42%] z-30 -translate-x-1/2 rounded-full border border-edge/80 bg-surface/90 p-2 text-muted shadow-lg backdrop-blur-sm transition-colors hover:border-accent/40 hover:text-foreground max-lg:hidden"
        >
          <ChevronLeft />
        </button>
        <button
          type="button"
          aria-label="Next slide"
          onClick={() => goTo(active + 1)}
          className="absolute right-0 top-[42%] z-30 translate-x-1/2 rounded-full border border-edge/80 bg-surface/90 p-2 text-muted shadow-lg backdrop-blur-sm transition-colors hover:border-accent/40 hover:text-foreground max-lg:hidden"
        >
          <ChevronRight />
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
        <Link
          href="/subscribe/"
          className="rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-background transition-opacity hover:opacity-90"
        >
          Start {PRICING.trialDays}-day free trial
        </Link>
        <Link
          href="/football/world-cup/builder/"
          className="rounded-xl border border-edge px-6 py-2.5 text-sm font-semibold text-muted transition-colors hover:border-accent/40 hover:text-foreground"
        >
          Explore World Cup →
        </Link>
      </div>
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10 3L5 8l5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 3l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
