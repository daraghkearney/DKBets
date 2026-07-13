import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppShell from "@/components/AppShell";
import SubscriptionRoot from "@/components/subscription/SubscriptionRoot";
import { SportProvider } from "@/components/SportProvider";
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
  title: "DKBets · Multi-Sport Research Hub",
  description:
    "Football, NBA and horse racing — deep stats, probability models, builder intelligence and tipster research.",
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
            <AppShell>{children}</AppShell>
          </SportProvider>
        </SubscriptionRoot>
      </body>
    </html>
  );
}
