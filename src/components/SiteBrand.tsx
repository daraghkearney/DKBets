import Link from "next/link";

export default function SiteBrand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-lg font-black text-accent">
        DK
      </div>
      <div>
        <p className="text-lg font-bold leading-tight tracking-tight">
          DKBets{" "}
          <span className="font-normal text-muted">· World Cup Hub</span>
        </p>
        <p className="text-[11px] text-muted">
          Odds · Player stats · 1v1 matchups
        </p>
      </div>
    </Link>
  );
}
