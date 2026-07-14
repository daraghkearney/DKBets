"use client";

import { useEffect } from "react";

/** GitHub Pages can serve HTTP before Enforce HTTPS — bump visitors to TLS. */
export default function HttpsRedirect() {
  useEffect(() => {
    const { protocol, hostname, href } = window.location;
    if (protocol !== "http:") return;
    if (hostname === "localhost" || hostname === "127.0.0.1") return;
    window.location.replace(href.replace(/^http:/, "https:"));
  }, []);

  return null;
}
