import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import AttributionCapture from "@/components/marketing/AttributionCapture";
import HttpsRedirect from "@/components/marketing/HttpsRedirect";
import SubscriptionRoot from "@/components/subscription/SubscriptionRoot";
import { SportProvider } from "@/components/SportProvider";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://statmanac.com"),
  title: `${BRAND.name} · ${BRAND.tagline}`,
  description: BRAND.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SubscriptionRoot>
          <SportProvider>
            <HttpsRedirect />
            <Suspense fallback={null}>
              <AttributionCapture />
            </Suspense>
            <AppShell>{children}</AppShell>
          </SportProvider>
        </SubscriptionRoot>
      </body>
    </html>
  );
}
