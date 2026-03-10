"use client";

import { AgentForm } from "@sanbao/ui/components/agents/AgentForm";
import { useBillingStore } from "@/stores/billingStore";

export default function NewAgentPage() {
  const canUseRag = useBillingStore((s) => s.plan?.canUseRag ?? false);
  return <AgentForm canUseRag={canUseRag} />;
}
