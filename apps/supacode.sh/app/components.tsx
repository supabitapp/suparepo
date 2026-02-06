"use client";

import { AppleFinderIcon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import { posthog } from "posthog-js";
import type { ReactNode } from "react";

export function DownloadButton() {
  return (
    <a
      href="https://supacode.sh/download/latest/supacode.dmg"
      onClick={() => posthog.capture("download_clicked")}
    >
      <Button size="lg" className="gap-2">
        <HugeiconsIcon icon={AppleFinderIcon} className="size-4" strokeWidth={2} />
        Download FREE for macOS (BETA)
      </Button>
    </a>
  );
}

export function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <Collapsible onOpenChange={(open) => open && posthog.capture("faq_opened", { question })}>
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-2 text-left text-sm font-medium">
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
          strokeWidth={2}
        />
        {question}
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden pl-6 text-xs text-muted-foreground data-[ending-style]:animate-collapse-out data-[starting-style]:animate-collapse-out data-[open]:animate-collapse-in">
        {answer}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function TrackedLink({
  href,
  event,
  children,
  className,
}: {
  href: string;
  event: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a href={href} className={className} onClick={() => posthog.capture(event, { href })}>
      {children}
    </a>
  );
}
