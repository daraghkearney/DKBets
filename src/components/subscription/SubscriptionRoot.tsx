"use client";

import { ClerkProvider } from "@clerk/clerk-react";
import { isSubscriptionEnabled } from "@/lib/subscription/config";

export default function SubscriptionRoot({
  children,
}: {
  children: React.ReactNode;
}) {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

  if (!isSubscriptionEnabled() || !key) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={key}
      signInUrl="/sign-in/"
      signUpUrl="/sign-up/"
      afterSignInUrl="/"
      afterSignUpUrl="/subscribe/"
    >
      {children}
    </ClerkProvider>
  );
}
