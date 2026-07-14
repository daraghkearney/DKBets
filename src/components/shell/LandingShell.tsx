import AuthControls from "@/components/subscription/AuthControls";
import BrandLogo from "@/components/brand/BrandLogo";
import { BRAND } from "@/lib/brand";

export default function LandingShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-edge/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <BrandLogo />
          <AuthControls />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-edge/50 py-8 text-center text-[11px] text-muted">
        {BRAND.name} · {BRAND.tagline} · 18+ · GambleAware.org
      </footer>
    </div>
  );
}
