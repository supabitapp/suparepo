import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Supacode Docs", template: "%s | Supacode Docs" },
  description: "Documentation for Supacode - Run 50+ coding agents in parallel",
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "Supacode Docs",
    description: "Documentation for Supacode - Run 50+ coding agents in parallel",
    siteName: "Supacode Docs",
  },
  twitter: {
    card: "summary",
    creator: "@khoiracle",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider
          search={{
            options: {
              type: "static",
            },
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
