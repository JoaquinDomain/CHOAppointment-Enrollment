import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import HydrationPing from "@/components/HydrationPing";
import Navigation from "@/components/Navigation";
import PrivacyPolicyLink from "@/components/PrivacyPolicyLink";
import { PAGE_HEALTH_SCRIPT } from "@/lib/pageHealth";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ||
      "https://cho-appointment-services.bacolodcity.gov.ph",
  ),
  title: "CHO Laboratory Appointment System - Bacolod City Health Office",
  description:
    "Book laboratory appointments online with the City Health Office Bacolod. Schedule your visit, manage enrollment records, and access healthcare services efficiently.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: PAGE_HEALTH_SCRIPT }}
        />
        <HydrationPing />
        <Navigation />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200/80 bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-center sm:flex-row sm:px-6 sm:text-left">
            <p className="text-xs font-medium text-slate-500">
              <span className="font-bold text-slate-700">CHO Bacolod</span> · City
              Health Office · Monday–Friday, from 8:00 AM
            </p>
            <div className="flex flex-col items-center gap-1 text-xs text-slate-400 sm:flex-row sm:gap-3">
              <PrivacyPolicyLink variant="muted" className="text-xs" />
              <span aria-hidden className="hidden sm:inline">·</span>
              <Link href="/privacy" className="font-semibold hover:text-emerald-700">
                Privacy Notice
              </Link>
              <span aria-hidden className="hidden sm:inline">·</span>
              <span>Bring a valid ID and your QR confirmation on your visit.</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
