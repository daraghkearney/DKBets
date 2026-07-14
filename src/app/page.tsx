import Link from "next/link";
import ProShowcase from "@/components/marketing/ProShowcase";
import SportQuickNav from "@/components/marketing/SportQuickNav";
import SportCard from "@/components/sports/SportCard";
import { SPORTS } from "@/lib/sports/config";
import { PRICING } from "@/lib/subscription/config";
import { BRAND } from "@/lib/brand";

export default function HomePage() {
  return (
    <div className="relative min-h-[calc(100vh-8rem)] overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute right-1/4 top-1/3 h-[400px] w-[400px] rounded-full bg-orange-500/5 blur-[100px]" />
        <div className="absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-amber-500/5 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-16 lg:py-20">
        {/* Hero — copy + live product showcase */}
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16 xl:gap-20">
          <div className="text-center lg:text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-accent">
              {BRAND.tagline}
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:mt-4 sm:text-5xl xl:text-[3.25rem] xl:leading-[1.1]">
              Welcome to{" "}
              <span className="bg-gradient-to-r from-accent via-gold to-orange-400 bg-clip-text text-transparent">
                {BRAND.name}
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted sm:mt-5 sm:text-lg lg:mx-0">
              {BRAND.description}
            </p>

            <SportQuickNav />

            <ul className="mx-auto mt-5 hidden max-w-md flex-col gap-2.5 text-left text-sm text-muted sm:flex lg:mx-0">
              {[
                "Underpriced gems with standout hit-rates",
                "Positional matchups & career head-to-head",
                "Bet365 builders priced to live odds targets",
                "Racing value naps & tipster intelligence",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <p className="mt-5 hidden text-xs text-muted sm:block lg:text-left">
              <span className="font-semibold text-gold">{BRAND.proName}</span> ·
              from £{PRICING.footballMonthlyGbp}/mo ·{" "}
              {PRICING.trialDays}-day free trial
            </p>
          </div>

          <ProShowcase />
        </div>

        {/* Sports grid */}
        <div
          id="sports"
          className="mt-12 scroll-mt-24 border-t border-edge/50 pt-10 sm:mt-16 sm:pt-14 lg:mt-20 lg:pt-16"
        >
          <div className="mb-8 text-center sm:mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted">
              Multi-sport research
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Pick your sport
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {SPORTS.map((sport) => (
              <SportCard key={sport.id} sport={sport} />
            ))}
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:mt-14 sm:grid-cols-3 sm:gap-4">
          {[
            { n: "3", label: "Sports", sub: "Football · NBA · Racing" },
            { n: "12+", label: "Competitions", sub: "Leagues & festivals" },
            { n: "Web+", label: "Research layers", sub: "Stats + tipster intel" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-edge/60 bg-surface/50 px-5 py-4 text-center"
            >
              <p className="text-2xl font-black text-foreground">{stat.n}</p>
              <p className="text-sm font-semibold">{stat.label}</p>
              <p className="text-[11px] text-muted">{stat.sub}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted sm:mt-10">
          Previously World Cup only — now multi-sport.{" "}
          <Link
            href="/football/world-cup/"
            className="text-accent underline underline-offset-2"
          >
            Jump straight to World Cup →
          </Link>
          {" · "}
          <Link
            href="/subscribe/"
            className="text-gold underline underline-offset-2"
          >
            View all plans →
          </Link>
        </p>
      </div>
    </div>
  );
}
