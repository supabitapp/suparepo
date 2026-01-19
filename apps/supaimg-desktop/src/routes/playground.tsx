import { createFileRoute, redirect } from "@tanstack/react-router";
import { Playground } from "@/playground";

export const Route = createFileRoute("/playground")({
  beforeLoad: () => {
    if (import.meta.env.PROD) {
      throw redirect({ to: "/" });
    }
  },
  component: PlaygroundPage,
});

function PlaygroundPage() {
  return (
    <div className="h-screen bg-background text-foreground">
      <Playground />
    </div>
  );
}
