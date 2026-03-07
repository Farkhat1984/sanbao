"use client";

import { use } from "react";
import { AgentForm } from "@/components/agents/AgentForm";

export default function NewOrgAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <AgentForm orgId={id} />;
}
