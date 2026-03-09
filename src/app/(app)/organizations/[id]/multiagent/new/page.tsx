import { MultiAgentForm } from "@/components/agents/MultiAgentForm";

export default async function NewMultiAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MultiAgentForm orgId={id} />;
}
