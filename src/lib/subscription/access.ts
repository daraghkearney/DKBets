"use client";

import { useAuth, useUser } from "@clerk/clerk-react";
import { isFootballFreeDuringWorldCup } from "@/lib/marketing/world-cup-promo";
import { hasComplimentaryAccess } from "@/lib/subscription/complimentary";
import {
  ALL_PLAN_SLUGS,
  FEATURES,
  isSubscriptionEnabled,
  planIncludesFeature,
  type FeatureSlug,
} from "./config";

export interface PremiumAccess {
  enabled: boolean;
  isLoading: boolean;
  isSignedIn: boolean;
  isPremium: boolean;
}

function checkAccess(
  has: ((args: Record<string, string>) => boolean) | undefined,
  feature?: FeatureSlug
): boolean {
  if (!has) return false;

  if (has({ feature: FEATURES.fullAccess })) return true;
  if (feature && has({ feature })) return true;

  for (const slug of ALL_PLAN_SLUGS) {
    if (has({ plan: slug }) && planIncludesFeature(slug, feature)) {
      return true;
    }
  }

  return false;
}

export function usePremiumAccess(feature?: FeatureSlug): PremiumAccess {
  const enabled = isSubscriptionEnabled();
  const { isLoaded: authLoaded, isSignedIn, has } = useAuth();
  const { isLoaded: userLoaded, user } = useUser();
  const isLoaded = authLoaded && (!isSignedIn || userLoaded);

  if (!enabled) {
    return {
      enabled: false,
      isLoading: false,
      isSignedIn: true,
      isPremium: true,
    };
  }

  if (isFootballFreeDuringWorldCup(feature)) {
    if (!isLoaded) {
      return {
        enabled: true,
        isLoading: true,
        isSignedIn: false,
        isPremium: false,
      };
    }
    if (!isSignedIn) {
      return {
        enabled: true,
        isLoading: false,
        isSignedIn: false,
        isPremium: false,
      };
    }
    return {
      enabled: true,
      isLoading: false,
      isSignedIn: true,
      isPremium: true,
    };
  }

  if (!isLoaded) {
    return { enabled: true, isLoading: true, isSignedIn: false, isPremium: false };
  }

  if (!isSignedIn) {
    return { enabled: true, isLoading: false, isSignedIn: false, isPremium: false };
  }

  const complimentary = hasComplimentaryAccess(
    user?.publicMetadata as Record<string, unknown> | undefined
  );

  return {
    enabled: true,
    isLoading: false,
    isSignedIn: true,
    isPremium: complimentary || checkAccess(has, feature),
  };
}
