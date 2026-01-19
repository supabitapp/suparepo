import { Button } from "@repo/ui/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect } from "react";

export function WorkflowShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      navigate({ to: "/" });
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [navigate]);

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Button variant="ghost" onClick={() => navigate({ to: "/" })} className="text-xs">
          Back
        </Button>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
        <div className="w-12" />
      </div>
      {children}
    </div>
  );
}
