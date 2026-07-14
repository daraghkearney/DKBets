"use client";

import { usePathname } from "next/navigation";
import WorldCupPromoBanner from "@/components/marketing/WorldCupPromoBanner";
import HubShell from "@/components/shell/HubShell";
import LandingShell from "@/components/shell/LandingShell";
import { isLandingPath } from "@/lib/sports/paths";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const landing = isLandingPath(pathname);

  return (
    <>
      <WorldCupPromoBanner />
      {landing ? (
        <LandingShell>{children}</LandingShell>
      ) : (
        <HubShell>{children}</HubShell>
      )}
    </>
  );
}
