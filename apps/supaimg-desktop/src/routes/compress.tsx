import { createFileRoute } from "@tanstack/react-router";
import { WorkflowPage } from "@/components/workflow-page";

export const Route = createFileRoute("/compress")({
  component: CompressPage,
});

function CompressPage() {
  return <WorkflowPage workflow="compress" />;
}
