"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { MultiAgentForm } from "@sanbao/ui/components/agents/MultiAgentForm";
import { useBillingStore } from "@/stores/billingStore";

export default function EditMultiAgentPage() {
  const params = useParams<{ id: string; multiAgentId: string }>();
  const [multiAgent, setMultiAgent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canUseRag = useBillingStore((s) => s.plan?.canUseRag ?? false);

  useEffect(() => {
    fetch(`/api/organizations/${params.id}/multiagents/${params.multiAgentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setMultiAgent(data);
        }
      })
      .catch(() => setError("Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [params.id, params.multiAgentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
      </div>
    );
  }

  if (error || !multiAgent) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8 text-center">
        <p className="text-text-secondary">{error || "Мультиагент не найден"}</p>
      </div>
    );
  }

  return (
    <MultiAgentForm
      orgId={params.id}
      canUseRag={canUseRag}
      multiAgent={{
        id: multiAgent.id as string,
        name: multiAgent.name as string,
        description: (multiAgent.description as string | null) ?? null,
        icon: (multiAgent.icon as string | null) ?? null,
        iconColor: (multiAgent.iconColor as string | null) ?? null,
        starterPrompts: (multiAgent.starterPrompts as string[]) || [],
        members: (multiAgent.members as Array<{ agentType: string; agentId: string }>) || [],
        files: (multiAgent.files as Array<{ id: string; fileName: string; fileType: string; fileUrl: string; fileSize: number; extractedText?: string | null; inContext?: boolean; createdAt: string }>) || [],
      }}
    />
  );
}
