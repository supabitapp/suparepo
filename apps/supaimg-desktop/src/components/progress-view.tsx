import { Progress } from "@repo/ui/components/ui/progress";

export function ProgressView({ label, progress }: { label: string; progress?: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Progress className="w-48" value={progress ?? null} />
    </div>
  );
}
