"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SignIn } from "@clerk/clerk-react";
import { isSubscriptionEnabled } from "@/lib/subscription/config";

export default function SignInPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isSubscriptionEnabled()) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted">
        Subscriptions are not enabled.{" "}
        <Link href="/" className="text-accent underline">
          Home
        </Link>
      </div>
    );
  }

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <SignIn routing="hash" signUpUrl="/sign-up/" />
    </div>
  );
}
