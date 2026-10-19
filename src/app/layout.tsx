import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { PRODUCT } from "@/lib/product";
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
  title: `${PRODUCT.name} AI Sales Bot`,
  description: "AI voice sales bot with live transcript, call recording, AI summary and sales status.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
                {PRODUCT.name[0]}
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">{PRODUCT.name} AI Sales Bot</p>
                <p className="hidden text-xs text-slate-500 sm:block">{PRODUCT.tagline}</p>
              </div>
            </Link>
            <nav className="flex gap-1 text-sm font-medium">
              <Link href="/" className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100">
                New Call
              </Link>
              <Link href="/history" className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100">
                Call History
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
