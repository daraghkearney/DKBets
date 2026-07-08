import Link from "next/link";

export default function LandingShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-edge/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/30 to-gold/20 text-lg font-black text-accent">
              DK
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight">DKBets</p>
              <p className="text-[11px] text-muted">
                Multi-sport research & probability engine
              </p>
            </div>
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-edge/50 py-8 text-center text-[11px] text-muted">
        DKBets · Research-led betting intelligence · 18+ · GambleAware.org
      </footer>
    </div>
  );
}
