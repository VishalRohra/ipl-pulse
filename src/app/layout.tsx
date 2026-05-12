import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://ipl-pulse.vercel.app"
  ),
  title: "IPL Pulse — Playoff scenarios for IPL 2026",
  description:
    "Pick winners of the remaining IPL 2026 matches and see how the playoff odds shift across all 10 teams. NRR-aware Monte Carlo simulation, built for r/IPL.",
  openGraph: {
    title: "IPL Pulse — Playoff scenarios for IPL 2026",
    description:
      "Pick winners of remaining matches and see how the playoff odds shift across all 10 teams.",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "IPL Pulse — Playoff scenarios for IPL 2026",
    description:
      "Pick winners of remaining matches and see how the playoff odds shift across all 10 teams.",
    images: ["/api/og"],
  },
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
