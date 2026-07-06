import SiteBrand from "@/components/SiteBrand";
import NavBar from "@/components/NavBar";
import { SampleModeProvider } from "@/components/SampleModeProvider";
import SampleModeSelector from "@/components/SampleModeSelector";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SampleModeProvider>
      <header className="sticky top-0 z-40 border-b border-edge bg-background/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <SiteBrand />
        </div>
        <NavBar />
        <SampleModeSelector />
      </header>
      {children}
      <footer className="mt-auto border-t border-edge py-6 text-center text-[11px] text-muted">
        DKBets · World Cup analysis tool · Stats via{" "}
        <a
          href="https://www.fotmob.com/"
          className="underline hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          FotMob
        </a>
        . 18+ · GambleAware.org
      </footer>
    </SampleModeProvider>
  );
}
