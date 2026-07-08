"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return (
    <p className="px-4 py-16 text-center text-sm text-muted">Redirecting…</p>
  );
}
