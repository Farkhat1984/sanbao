"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Bot, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrgAgentItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  fileCount: number;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  CREATING: { label: "Создание", icon: Loader2, color: "text-blue-500" },
  PROCESSING: { label: "Обработка", icon: Loader2, color: "text-amber-500" },
  READY: { label: "Готов", icon: CheckCircle, color: "text-emerald-500" },
  PUBLISHED: { label: "Опубликован", icon: CheckCircle, color: "text-accent" },
  ERROR: { label: "Ошибка", icon: AlertCircle, color: "text-red-500" },
};

export default function OrgAgentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [agents, setAgents] = useState<OrgAgentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orgId, setOrgId] = useState("");

  useEffect(() => {
    params.then(({ id }) => {
      setOrgId(id);
      fetch(`/api/organizations/${id}/agents`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setAgents(data);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    });
  }, [params]);

  return (
    <div className="h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => router.push(`/organizations/${orgId}`)}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl font-bold text-text-primary">AI-агенты</h1>
            <p className="text-sm text-text-muted mt-1">
              Агенты, созданные из ваших документов
            </p>
          </div>
          <button
            onClick={() => router.push(`/organizations/${orgId}/agents/new`)}
            className="h-10 px-5 rounded-xl bg-gradient-to-r from-accent to-legal-ref text-white text-sm font-medium flex items-center gap-2 hover:shadow-md transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Создать агента
          </button>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="p-5 rounded-2xl border border-border bg-surface animate-pulse">
                <div className="h-10 w-10 rounded-xl bg-surface-alt mb-3" />
                <div className="h-4 w-32 bg-surface-alt rounded mb-2" />
                <div className="h-3 w-24 bg-surface-alt rounded" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && agents.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {agents.map((agent) => {
              const config = STATUS_CONFIG[agent.status] || STATUS_CONFIG.CREATING;
              const StatusIcon = config.icon;
              return (
                <button
                  key={agent.id}
                  onClick={() => router.push(`/organizations/${orgId}/agents/${agent.id}`)}
                  className="p-5 rounded-2xl border border-border bg-surface hover:border-border-hover hover:shadow-sm transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                      <Bot className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
                        {agent.name}
                      </h3>
                      {agent.description && (
                        <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{agent.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span className={cn("flex items-center gap-1", config.color)}>
                      <StatusIcon className={cn("h-3.5 w-3.5", agent.status === "PROCESSING" && "animate-spin")} />
                      {config.label}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {agent.fileCount} файл(ов)
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!isLoading && agents.length === 0 && (
          <div className="text-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-surface-alt flex items-center justify-center mx-auto mb-5">
              <Bot className="h-8 w-8 text-text-muted" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">Нет агентов</h2>
            <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
              Создайте AI-агента, загрузив документы вашей организации.
            </p>
            <button
              onClick={() => router.push(`/organizations/${orgId}/agents/new`)}
              className="h-10 px-6 rounded-xl bg-accent text-white text-sm font-medium cursor-pointer"
            >
              Создать агента
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
