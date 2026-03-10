"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { AgentForm } from "@sanbao/ui/components/agents/AgentForm";
import { Skeleton } from "@sanbao/ui/components/ui/Skeleton";
import { useBillingStore } from "@/stores/billingStore";

export default function EditOrgAgentPage({
  params,
}: {
  params: Promise<{ id: string; agentId: string }>;
}) {
  const { id, agentId } = use(params);
  const [agent, setAgent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canUseRag = useBillingStore((s) => s.plan?.canUseRag ?? false);

  useEffect(() => {
    fetch(`/api/organizations/${id}/agents/${agentId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Агент не найден");
        return res.json();
      })
      .then((data) => setAgent(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, agentId]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-6 w-48 mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
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

  // Map org agent data to AgentForm's expected shape
  const agentForForm = {
    id: agent.id as string,
    name: agent.name as string,
    description: (agent.description as string) || null,
    instructions: (agent.instructions as string) || "",
    model: "default",
    icon: (agent.icon as string) || "Bot",
    iconColor: (agent.iconColor as string) || "#8FAF9F",
    starterPrompts: (agent.starterPrompts as string[]) || [],
    files: [],
    skills: (agent.skills as Array<{ id: string; skill: { id: string; name: string; icon: string; iconColor: string } }>) || [],
    mcpServers: (agent.mcpServers as Array<{ id: string; mcpServer: { id: string; name: string; url: string; status: string } }>) || [],
    createdAt: agent.createdAt as string,
    updatedAt: agent.updatedAt as string,
  };

  return <AgentForm agent={agentForForm} orgId={id} canUseRag={canUseRag} />;
}
