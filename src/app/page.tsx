import Link from "next/link";
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

      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-accent">
            {BRAND.tagline}
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-accent via-gold to-orange-400 bg-clip-text text-transparent">
              {BRAND.name}
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            {BRAND.description}
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {SPORTS.map((sport) => (
            <SportCard key={sport.id} sport={sport} />
          ))}
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3">
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

        <p className="mt-12 text-center text-xs text-muted">
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
            {BRAND.proName} from £{PRICING.footballMonthlyGbp}/mo →
          </Link>
        </p>
      </div>
    </div>
  );
}
