"use client";

import { useEffect, useState } from "react";
import { usePremiumAccess } from "@/lib/subscription/access";
import type { FeatureSlug } from "@/lib/subscription/config";
import { isSubscriptionEnabled } from "@/lib/subscription/config";
import { isFootballFreeDuringWorldCup } from "@/lib/marketing/world-cup-promo";
import SignUpPrompt from "./SignUpPrompt";
import UpgradePrompt from "./UpgradePrompt";

function PremiumGateInner({
  children,
  feature,
  compact = false,
  teaser,
}: {
  children?: React.ReactNode;
  feature?: FeatureSlug;
  compact?: boolean;
  teaser?: React.ReactNode;
}) {
  const { isLoading, isPremium, isSignedIn } = usePremiumAccess(feature);
  const needsSignUp =
    isFootballFreeDuringWorldCup(feature) && !isSignedIn && !isPremium;

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-muted">
        Checking access…
      </div>
    );
  }

  if (isPremium) {
    return children ? <>{children}</> : null;
  }

  if (needsSignUp) {
    return (
      <div className={compact ? "" : "py-8"}>
        {teaser}
        <SignUpPrompt compact={compact} />
      </div>
    );
  }

  return (
    <div className={compact ? "" : "py-8"}>
      {teaser}
      <UpgradePrompt feature={feature} compact={compact} />
    </div>
  );
}

/** Client-only gate — avoids Clerk hooks during static export SSR. */
export default function PremiumGate({
  children,
  feature,
  compact = false,
  teaser,
}: {
  children?: React.ReactNode;
  feature?: FeatureSlug;
  compact?: boolean;
  teaser?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isSubscriptionEnabled()) {
    return <>{children}</>;
  }

  if (!mounted) {
    return (
      <div className="flex min-h-[120px] items-center justify-center text-sm text-muted">
        Loading…
      </div>
    );
  }

  return (
    <PremiumGateInner feature={feature} compact={compact} teaser={teaser}>
      {children}
    </PremiumGateInner>
  );
}
