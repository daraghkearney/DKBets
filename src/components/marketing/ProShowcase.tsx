"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { assetUrl } from "@/lib/basePath";
import { BRAND } from "@/lib/brand";
import { isWorldCupFreeActive } from "@/lib/marketing/world-cup-promo";
import { useAttributionHref } from "@/hooks/useAttributionHref";
import { PRICING } from "@/lib/subscription/config";

const INTERVAL_MS = 3800;

const SLIDES = [
  {
    src: "/showcase/builder.png",
    alt: "Bet365 builder with odds targets and live leg hit-rates",
    tag: "Bet365 Builder",
    title: "Build to any odds target",
    description:
      "Highest-probability legs from live Bet365 prices — evens through 50/1, ranked by model hit-rate.",
    accent: "#22c55e",
    width: 1024,
    height: 680,
  },
  {
    src: "/showcase/star-player.png",
    alt: "Star player special with standout gem stat and combined probability",
    tag: "Star Player",
    title: "Standout gem specials",
    description:
      "Player props backed by tournament form, with combined-probability builders and one-click Bet365 links.",
    accent: "#fbbf24",
    width: 830,
    height: 768,
  },
  {
    src: "/showcase/matchups.png",
    alt: "Positional duels with pitch overlay and pick of the day",
    tag: "Positional Duels",
    title: "1v1 tactical matchups",
    description:
      "Pitch overlays, career H2H history and pick-of-the-day props from positional duels.",
    accent: "#3b82f6",
    width: 1024,
    height: 680,
  },
] as const;

function slideOffset(index: number, active: number, total: number): number {
  let diff = index - active;
  if (diff > total / 2) diff -= total;
  if (diff < -total / 2) diff += total;
  return diff;
}

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
  const worldCupFree = isWorldCupFreeActive();
  const builderHref = useAttributionHref("/football/world-cup/builder/");
  const starPlayersHref = useAttributionHref("/football/world-cup/star-players/");
  const subscribeHref = useAttributionHref("/subscribe/");

  return (
    <div
      className="relative mx-auto w-full max-w-xl lg:max-w-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="pointer-events-none absolute -inset-8 rounded-[3rem] opacity-60 blur-3xl transition-colors duration-700"
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 40%, ${slide.accent}22, transparent 70%)`,
        }}
      />

      <div className="showcase-float relative">
        <div className="mb-3 flex items-center justify-between gap-3 px-1 sm:mb-4">
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
                    ? "w-6 bg-gold"
                    : "w-1.5 bg-edge hover:bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Coverflow carousel */}
        <div className="showcase-stage relative mx-auto h-[280px] w-full overflow-visible sm:h-[340px] lg:h-[360px]">
          {SLIDES.map((s, i) => {
            const offset = slideOffset(i, active, SLIDES.length);
            const isActive = offset === 0;
            const isSide = Math.abs(offset) === 1;

            return (
              <div
                key={s.src}
                className={`showcase-card absolute left-1/2 top-1/2 transition-all duration-500 ease-out ${
                  isActive
                    ? "z-30"
                    : isSide
                      ? "z-20 cursor-pointer"
                      : "z-0 pointer-events-none"
                }`}
                style={{
                  transform: isActive
                    ? "translate(-50%, -50%) scale(1)"
                    : offset === -1
                      ? "translate(calc(-50% - 52%), -50%) scale(0.78)"
                      : offset === 1
                        ? "translate(calc(-50% + 52%), -50%) scale(0.78)"
                        : "translate(-50%, -50%) scale(0.55)",
                  opacity: isActive ? 1 : isSide ? 0.55 : 0,
                  filter: isActive ? "none" : "brightness(0.72)",
                }}
                aria-hidden={!isActive && !isSide}
                onClick={isSide ? () => goTo(i) : undefined}
                onKeyDown={
                  isSide
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") goTo(i);
                      }
                    : undefined
                }
                role={isSide ? "button" : undefined}
                tabIndex={isSide ? 0 : undefined}
              >
                <div
                  className={`overflow-hidden rounded-2xl bg-background transition-shadow duration-500 ${
                    isActive
                      ? "showcase-ring-active ring-2 ring-gold/80 ring-offset-2 ring-offset-background shadow-[0_0_40px_rgba(251,191,36,0.28),0_20px_50px_-12px_rgba(0,0,0,0.65)]"
                      : "ring-1 ring-gold/35 ring-offset-1 ring-offset-background shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)]"
                  }`}
                >
                  <Image
                    src={assetUrl(s.src)}
                    alt={s.alt}
                    width={s.width}
                    height={s.height}
                    priority={i === 0}
                    className={`block h-auto w-[min(78vw,300px)] sm:w-[min(72vw,320px)] ${
                      isActive
                        ? "sm:w-[min(68vw,360px)] lg:w-[380px]"
                        : "sm:w-[240px]"
                    }`}
                    sizes="(max-width: 640px) 78vw, 380px"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-edge">
          <div
            className="h-full bg-gold transition-[width] duration-75 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div
          key={active}
          className="showcase-caption mt-4 rounded-2xl border border-gold/20 bg-surface/60 px-4 py-3 backdrop-blur-sm sm:mt-5 sm:px-5 sm:py-4"
        >
          <h3 className="text-base font-bold tracking-tight">{slide.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {slide.description}
          </p>
        </div>

        <button
          type="button"
          aria-label="Previous slide"
          onClick={() => goTo(active - 1)}
          className="absolute left-0 top-[38%] z-40 -translate-x-1/2 rounded-full border border-gold/30 bg-surface/90 p-2 text-muted shadow-lg backdrop-blur-sm transition-colors hover:border-gold/60 hover:text-gold max-lg:hidden"
        >
          <ChevronLeft />
        </button>
        <button
          type="button"
          aria-label="Next slide"
          onClick={() => goTo(active + 1)}
          className="absolute right-0 top-[38%] z-40 translate-x-1/2 rounded-full border border-gold/30 bg-surface/90 p-2 text-muted shadow-lg backdrop-blur-sm transition-colors hover:border-gold/60 hover:text-gold max-lg:hidden"
        >
          <ChevronRight />
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:mt-6 lg:justify-start">
        {worldCupFree ? (
          <>
            <Link
              href={builderHref}
              className="rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-background transition-opacity hover:opacity-90"
            >
              Try World Cup free
            </Link>
            <Link
              href={starPlayersHref}
              className="rounded-xl border border-edge px-6 py-2.5 text-sm font-semibold text-muted transition-colors hover:border-gold/40 hover:text-foreground"
            >
              Star players →
            </Link>
          </>
        ) : (
          <>
            <Link
              href={subscribeHref}
              className="rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-background transition-opacity hover:opacity-90"
            >
              Start {PRICING.trialDays}-day free trial
            </Link>
            <Link
              href={builderHref}
              className="rounded-xl border border-edge px-6 py-2.5 text-sm font-semibold text-muted transition-colors hover:border-gold/40 hover:text-foreground"
            >
              Explore World Cup →
            </Link>
          </>
        )}
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
