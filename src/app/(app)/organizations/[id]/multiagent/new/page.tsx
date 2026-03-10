"use client";

import { use } from "react";
import { MultiAgentForm } from "@sanbao/ui/components/agents/MultiAgentForm";
import { useBillingStore } from "@/stores/billingStore";

export default function NewMultiAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const canUseRag = useBillingStore((s) => s.plan?.canUseRag ?? false);
  return <MultiAgentForm orgId={id} canUseRag={canUseRag} />;
}
