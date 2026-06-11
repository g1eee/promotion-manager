import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

/** Body / UI typeface: dense-data friendly, neutral workhorse. */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--pms-font-inter",
});

/** Display typeface: headings and metric numbers — technical, confident. */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--pms-font-space-grotesk",
});

/** Mono typeface: product IDs, currency, tabular data. */
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--pms-font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Promotion Management System",
  description: "Internal multi-brand marketplace promo management",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetBrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
