import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import type { ReactNode } from "react";
import "nextra-theme-docs/style.css";

export const metadata = {
  metadataBase: new URL("https://docs.supacode.sh"),
  title: {
    default: "Supacode Docs",
    template: "%s | Supacode Docs",
  },
  description: "Documentation for Supacode - Run 50+ coding agents in parallel.",
  icons: {
    icon: "https://supacode.sh/supacode-app-icon.png",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={<Navbar logo={<span>Supacode</span>} />}
          pageMap={await getPageMap()}
          footer={<Footer />}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
