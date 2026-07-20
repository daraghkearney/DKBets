"use client";

import { ClerkProvider } from "@clerk/clerk-react";
import { useRouter } from "next/navigation";
import { getClerkPublishableKey } from "@/lib/subscription/clerkKey";
import { isSubscriptionEnabled } from "@/lib/subscription/config";

export default function SubscriptionRoot({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const key = getClerkPublishableKey();

  if (!isSubscriptionEnabled() || !key) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={key}
      routerPush={(to) => router.push(to)}
      routerReplace={(to) => router.replace(to)}
      signInUrl="/sign-in/"
      signUpUrl="/sign-up/"
      afterSignInUrl="/"
      afterSignUpUrl="/subscribe/"
    >
      {children}
    </ClerkProvider>
  );
}
