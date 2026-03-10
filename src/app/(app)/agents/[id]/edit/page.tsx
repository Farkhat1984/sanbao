"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AgentForm } from "@sanbao/ui/components/agents/AgentForm";
import { Skeleton } from "@sanbao/ui/components/ui/Skeleton";
import { useBillingStore } from "@/stores/billingStore";
import type { Agent } from "@/types/agent";

export default function EditAgentPage() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canUseRag = useBillingStore((s) => s.plan?.canUseRag ?? false);

  useEffect(() => {
    fetch(`/api/agents/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Агент не найден");
        return res.json();
      })
      .then((data) => setAgent(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-6 w-48 mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-secondary">{error || "Агент не найден"}</p>
      </div>
    );
  }

  return <AgentForm agent={agent} canUseRag={canUseRag} />;
}
