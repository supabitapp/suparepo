import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-supacode",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Supacode",
  description: "Fully native orchestration for your own agents.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} dark`}>
      <body>{children}</body>
    </html>
  );
}
