"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAgentStore } from "@/stores/agentStore";
import { AgentCard } from "@/components/agents/AgentCard";
import { SystemAgentCard } from "@/components/agents/SystemAgentCard";
import { Skeleton } from "@/components/ui/Skeleton";

interface SystemAgentInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconColor: string;
  isSystem: boolean;
}

export default function AgentsPage() {
  const router = useRouter();
  const { agents, setAgents, isLoading, setLoading } = useAgentStore();
  const [loaded, setLoaded] = useState(false);
  const [systemAgents, setSystemAgents] = useState<SystemAgentInfo[]>([]);

  useEffect(() => {
    setLoading(true);
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => {
        if (data.systemAgents) setSystemAgents(data.systemAgents);
        if (data.userAgents) setAgents(data.userAgents);
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false);
        setLoaded(true);
      });
  }, [setAgents, setLoading]);

  return (
    <div className="h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              Агенты
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Системные и персональные AI-ассистенты
            </p>
          </div>
          <button
            onClick={() => router.push("/agents/new")}
            className="h-10 px-5 rounded-xl bg-gradient-to-r from-accent to-legal-ref text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Создать агента
          </button>
        </div>

        {/* Loading */}
        {isLoading && !loaded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-5 rounded-2xl border border-border bg-surface">
                <div className="flex items-start gap-3 mb-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-1.5" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full mb-1.5" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        )}

        {/* Agent Grid — System agents first, then user agents */}
        {loaded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* System agents from API */}
            {systemAgents.map((agent) => (
              <SystemAgentCard key={agent.id} agent={agent} />
            ))}

            {/* User agents */}
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}

        {/* Empty hint (when no user agents) */}
        {loaded && agents.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-text-muted">
              Создайте персонального агента с уникальными инструкциями и файлами знаний
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
