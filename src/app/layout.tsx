import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "CHO Laboratory Appointment System - Bacolod City Health Office",
  description: "Book laboratory appointments online with the City Health Office Bacolod. Schedule your visit, manage enrollment records, and access healthcare services efficiently.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Navigation />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200/80 bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-center sm:flex-row sm:px-6 sm:text-left">
            <p className="text-xs font-medium text-slate-500">
              <span className="font-bold text-slate-700">CHO Bacolod</span> · City Health Office · Mon–Fri, from 8:00 AM
            </p>
            <p className="text-xs text-slate-400">
              Bring a valid ID and your QR confirmation on your visit.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
