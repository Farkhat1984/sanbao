"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Rocket, Trash2, FileText, RefreshCw, MessageSquare } from "lucide-react";
import { AgentProgressBar } from "@/components/organizations/AgentProgressBar";
import { cn } from "@/lib/utils";

interface AgentDetail {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  status: string;
  projectId: string | null;
  mcpServer: { id: string; name: string; status: string; discoveredTools: unknown[] | null } | null;
  files: Array<{ id: string; fileName: string; fileType: string; fileSize: number; createdAt: string }>;
  fileCount: number;
  conversationCount: number;
}

export default function OrgAgentDetailPage({
  params,
}: {
  params: Promise<{ id: string; agentId: string }>;
}) {
  const router = useRouter();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ids, setIds] = useState({ id: "", agentId: "" });

  const loadAgent = useCallback(async () => {
    const { id, agentId } = await params;
    setIds({ id, agentId });
    try {
      const res = await fetch(`/api/organizations/${id}/agents/${agentId}`);
      const data = await res.json();
      if (!res.ok) setError(data.error);
      else setAgent(data);
    } catch {
      setError("Ошибка загрузки");
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  const handleProcess = async () => {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${ids.id}/agents/${ids.agentId}/process`, {
        method: "POST",
      });
      if (res.ok) {
        setAgent((a) => a ? { ...a, status: "PROCESSING" } : a);
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } catch {
      setError("Ошибка");
    } finally {
      setProcessing(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${ids.id}/agents/${ids.agentId}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setAgent(data);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Ошибка");
    } finally {
      setPublishing(false);
    }
  };

  const handleReprocess = async () => {
    setReprocessing(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${ids.id}/agents/${ids.agentId}/reprocess`, {
        method: "POST",
      });
      if (res.ok) {
        await loadAgent();
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } catch {
      setError("Ошибка");
    } finally {
      setReprocessing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Удалить агента? Все данные будут потеряны.")) return;
    try {
      const res = await fetch(`/api/organizations/${ids.id}/agents/${ids.agentId}`, {
        method: "DELETE",
      });
      if (res.ok) router.push(`/organizations/${ids.id}/agents`);
    } catch {
      // ignore
    }
  };

  const handleChat = () => {
    router.push(`/chat?orgAgentId=${ids.agentId}`);
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-surface-alt rounded" />
          <div className="h-32 bg-surface-alt rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 text-center">
        <p className="text-text-muted">{error || "Агент не найден"}</p>
      </div>
    );
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  return (
    <div className="h-full">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => router.push(`/organizations/${ids.id}/agents`)}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Агенты
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{agent.name}</h1>
            {agent.description && (
              <p className="text-sm text-text-muted mt-1">{agent.description}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {agent.status === "PUBLISHED" && (
              <button
                onClick={handleChat}
                className="h-9 px-4 rounded-xl bg-accent text-white text-sm font-medium flex items-center gap-2 cursor-pointer"
              >
                <MessageSquare className="h-4 w-4" />
                Чат
              </button>
            )}
            <button
              onClick={handleDelete}
              className="h-9 px-3 rounded-xl border border-red-200 text-red-600 text-sm flex items-center gap-1 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Status & Actions */}
        <div className="p-5 rounded-2xl border border-border bg-surface mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-text-primary">Статус</span>
            <StatusBadge status={agent.status} />
          </div>

          {agent.status === "PROCESSING" && (
            <AgentProgressBar orgId={ids.id} agentId={ids.agentId} />
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            {(agent.status === "CREATING" || agent.status === "ERROR") && agent.files.length > 0 && (
              <button
                onClick={handleProcess}
                disabled={processing}
                className="h-9 px-4 rounded-xl bg-amber-500 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Play className="h-4 w-4" />
                {processing ? "Запуск..." : "Обработать"}
              </button>
            )}

            {(agent.status === "READY" || agent.status === "PROCESSING") && (
              <button
                onClick={handlePublish}
                disabled={publishing || agent.status === "PROCESSING"}
                className="h-9 px-4 rounded-xl bg-accent text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Rocket className="h-4 w-4" />
                {publishing ? "Публикация..." : "Опубликовать"}
              </button>
            )}

            {agent.status === "PUBLISHED" && (
              <button
                onClick={handleReprocess}
                disabled={reprocessing}
                className="h-9 px-4 rounded-xl border border-border text-text-primary text-sm font-medium flex items-center gap-2 hover:bg-surface-alt transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={cn("h-4 w-4", reprocessing && "animate-spin")} />
                {reprocessing ? "Переобработка..." : "Переобработать"}
              </button>
            )}
          </div>
        </div>

        {/* MCP Tools */}
        {agent.mcpServer && agent.mcpServer.discoveredTools && (
          <div className="p-5 rounded-2xl border border-border bg-surface mb-6">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Инструменты MCP</h2>
            <div className="space-y-1">
              {(agent.mcpServer.discoveredTools as Array<{ name: string; description: string }>).map((tool) => (
                <div key={tool.name} className="flex items-start gap-2 py-1.5">
                  <code className="text-xs bg-surface-alt px-1.5 py-0.5 rounded font-mono text-accent shrink-0">
                    {tool.name}
                  </code>
                  <span className="text-xs text-text-muted">{tool.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files */}
        <div className="p-5 rounded-2xl border border-border bg-surface">
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            Файлы ({agent.files.length})
          </h2>
          {agent.files.length === 0 ? (
            <p className="text-sm text-text-muted">Нет загруженных файлов</p>
          ) : (
            <div className="space-y-2">
              {agent.files.map((file) => (
                <div key={file.id} className="flex items-center gap-3 py-2">
                  <FileText className="h-4 w-4 text-text-muted shrink-0" />
                  <span className="text-sm text-text-primary truncate flex-1">{file.fileName}</span>
                  <span className="text-xs text-text-muted shrink-0">{formatSize(file.fileSize)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    CREATING: { label: "Создание", cls: "bg-blue-500/10 text-blue-600" },
    PROCESSING: { label: "Обработка", cls: "bg-amber-500/10 text-amber-600" },
    READY: { label: "Готов", cls: "bg-emerald-500/10 text-emerald-600" },
    PUBLISHED: { label: "Опубликован", cls: "bg-accent/10 text-accent" },
    ERROR: { label: "Ошибка", cls: "bg-red-500/10 text-red-600" },
  };
  const c = config[status] || config.CREATING;
  return (
    <span className={cn("px-2.5 py-1 rounded-lg text-xs font-medium", c.cls)}>
      {c.label}
    </span>
  );
}
