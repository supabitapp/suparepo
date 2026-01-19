import { createFileRoute } from "@tanstack/react-router";
import { WorkflowPage } from "@/components/workflow-page";

export const Route = createFileRoute("/convert")({
  component: ConvertPage,
});

function ConvertPage() {
  return <WorkflowPage workflow="convert" />;
}
