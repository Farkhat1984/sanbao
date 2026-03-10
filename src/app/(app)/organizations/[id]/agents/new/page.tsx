"use client";

import { use } from "react";
import { AgentForm } from "@sanbao/ui/components/agents/AgentForm";
import { useBillingStore } from "@/stores/billingStore";

export default function NewOrgAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const canUseRag = useBillingStore((s) => s.plan?.canUseRag ?? false);
  return <AgentForm orgId={id} canUseRag={canUseRag} />;
}
