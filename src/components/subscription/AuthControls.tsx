"use client";

import { useEffect, useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";
import { usePremiumAccess } from "@/lib/subscription/access";
import { isSubscriptionEnabled } from "@/lib/subscription/config";
import { isWorldCupFreeActive } from "@/lib/marketing/world-cup-promo";
import { useAttributionHref } from "@/hooks/useAttributionHref";
import Link from "next/link";

function AuthControlsInner() {
  const { isPremium } = usePremiumAccess();
  const worldCupFree = isWorldCupFreeActive();
  const builderHref = useAttributionHref("/football/world-cup/builder/");
  const subscribeHref = useAttributionHref("/subscribe/");

  return (
    <div className="flex items-center gap-2">
      <SignedOut>
        <SignInButton mode="modal">
          <button
            type="button"
            className="rounded-lg border border-edge px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          >
            Sign in
          </button>
        </SignInButton>
        {worldCupFree ? (
          <Link
            href={builderHref}
            className="rounded-lg bg-accent/90 px-3 py-1.5 text-xs font-bold text-background transition-opacity hover:opacity-90"
          >
            Try World Cup free
          </Link>
        ) : (
          <Link
            href={subscribeHref}
            className="rounded-lg bg-accent/90 px-3 py-1.5 text-xs font-bold text-background transition-opacity hover:opacity-90"
          >
            Subscribe
          </Link>
        )}
      </SignedOut>
      <SignedIn>
        {worldCupFree && !isPremium && (
          <span className="hidden rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300 sm:inline">
            WC Free
          </span>
        )}
        {!isPremium && (
          <Link
            href={subscribeHref}
            className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold"
          >
            Upgrade
          </Link>
        )}
        {isPremium && (
          <span className="hidden rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300 sm:inline">
            Pro
          </span>
        )}
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: { avatarBox: "h-8 w-8" },
          }}
        />
      </SignedIn>
    </div>
  );
}

export default function AuthControls() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isSubscriptionEnabled()) {
    return null;
  }

  if (!mounted) {
    return null;
  }

  return <AuthControlsInner />;
}
