import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppThemeProvider } from "./theme-provider";

export const metadata: Metadata = {
  title: "Supabit - Useful, Simple, Opinionated Apps",
  description:
    "We are a small team of engineers who are passionate about building truly great products.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  );
}
