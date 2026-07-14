"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { captureAttributionFromLocation } from "@/lib/marketing/attribution";

/** Persists first-touch UTM/ref params from the landing URL. */
export default function AttributionCapture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const search = searchParams.toString();
    captureAttributionFromLocation(
      search ? `?${search}` : "",
      pathname || "/"
    );
  }, [pathname, searchParams]);

  return null;
}
