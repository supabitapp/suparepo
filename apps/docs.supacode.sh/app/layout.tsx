import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import type { ReactNode } from "react";
import "nextra-theme-docs/style.css";

export const metadata = {
  title: {
    default: "Supacode Docs",
    template: "%s | Supacode Docs",
  },
  description: "Documentation for Supacode",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={<Navbar logo={<span>Supacode</span>} />}
          pageMap={await getPageMap()}
          footer={<Footer>MIT {new Date().getFullYear()} © Supacode</Footer>}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
