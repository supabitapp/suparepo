import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { source } from "../../lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      nav={{
        title: (
          <div className="flex items-center gap-2">
            <img src="/supacode-app-icon.png" alt="Supacode" width={24} height={24} />
            <span className="font-medium">Supacode</span>
          </div>
        ),
      }}
      links={[{ text: "Home", url: "https://supacode.sh" }]}
      githubUrl="https://github.com/supabitapp/supacode-sh"
    >
      {children}
    </DocsLayout>
  );
}
