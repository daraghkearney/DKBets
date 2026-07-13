import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default function SiteBrand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-sm font-black text-accent">
        {BRAND.initials}
      </div>
      <div>
        <p className="text-lg font-bold leading-tight tracking-tight">
          {BRAND.name}
        </p>
        <p className="text-[11px] text-muted">{BRAND.tagline}</p>
      </div>
    </Link>
  );
}
