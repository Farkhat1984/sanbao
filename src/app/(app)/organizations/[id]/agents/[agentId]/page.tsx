"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Rocket, Trash2, FileText, RefreshCw, MessageSquare, Upload, AlertTriangle, Zap, Server, Pencil } from "lucide-react";
import { AgentProgressBar } from "@/components/organizations/AgentProgressBar";
import { FileUploader } from "@/components/organizations/FileUploader";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

interface AgentDetail {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  status: string;
  projectId: string | null;
  starterPrompts: string[];
  mcpServer: { id: string; name: string; status: string; discoveredTools: unknown[] | null } | null;
  skills: Array<{ id: string; skill: { id: string; name: string; icon: string; iconColor: string } }>;
  mcpServers: Array<{ id: string; mcpServer: { id: string; name: string; url: string; status: string } }>;
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
  const [showUploader, setShowUploader] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
    setDeleting(true);
    try {
      const res = await fetch(`/api/organizations/${ids.id}/agents/${ids.agentId}`, {
        method: "DELETE",
      });
      if (res.ok) router.push(`/organizations/${ids.id}/agents`);
    } catch {
      setError("Ошибка удаления");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleUploadComplete = async () => {
    setShowUploader(false);
    // Fetch fresh agent data to get current status
    const { id, agentId } = await params;
    try {
      const res = await fetch(`/api/organizations/${id}/agents/${agentId}`);
      const fresh = await res.json();
      if (res.ok) {
        setAgent(fresh);
        // Auto-process if agent is in CREATING or ERROR status
        if (fresh.status === "CREATING" || fresh.status === "ERROR") {
          handleProcess();
        }
      }
    } catch {
      // fallback: just reload
      await loadAgent();
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
        <p className="text-text-secondary">{error || "Агент не найден"}</p>
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
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Агенты
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">{agent.name}</h1>
            {agent.description && (
              <p className="text-sm text-text-secondary mt-1">{agent.description}</p>
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
              onClick={() => router.push(`/organizations/${ids.id}/agents/${ids.agentId}/edit`)}
              className="h-9 px-3 rounded-xl border border-border text-text-primary text-sm flex items-center gap-1.5 hover:bg-surface-alt transition-colors cursor-pointer"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="h-9 px-3 rounded-xl border border-error/20 text-error text-sm flex items-center gap-1 hover:bg-error-light transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-error-light text-error text-sm mb-4">
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
            <AgentProgressBar
              orgId={ids.id}
              agentId={ids.agentId}
              onComplete={async () => {
                // Update agent status to READY in DB
                try {
                  await fetch(`/api/organizations/${ids.id}/agents/${ids.agentId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "READY" }),
                  });
                } catch {
                  // Non-critical
                }
                await loadAgent();
              }}
            />
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            {(agent.status === "CREATING" || agent.status === "ERROR") && agent.files.length > 0 && (
              <button
                onClick={handleProcess}
                disabled={processing}
                className="h-9 px-4 rounded-xl bg-warning text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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
                  <span className="text-xs text-text-secondary">{tool.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Starter Prompts */}
        {agent.starterPrompts && agent.starterPrompts.length > 0 && (
          <div className="p-5 rounded-2xl border border-border bg-surface mb-6">
            <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-text-secondary" />
              Стартовые подсказки
            </h2>
            <div className="flex flex-wrap gap-2">
              {agent.starterPrompts.map((prompt, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-lg bg-surface-alt text-xs text-text-primary border border-border"
                >
                  {prompt}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Skills */}
        {agent.skills && agent.skills.length > 0 && (
          <div className="p-5 rounded-2xl border border-border bg-surface mb-6">
            <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-text-secondary" />
              Скиллы ({agent.skills.length})
            </h2>
            <div className="space-y-2">
              {agent.skills.map((as) => (
                <div key={as.id} className="flex items-center gap-2 py-1.5">
                  <span
                    className="h-6 w-6 rounded-md flex items-center justify-center text-xs"
                    style={{ backgroundColor: `${as.skill.iconColor}20`, color: as.skill.iconColor }}
                  >
                    {as.skill.icon?.charAt(0) || "S"}
                  </span>
                  <span className="text-sm text-text-primary">{as.skill.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional MCP Servers */}
        {agent.mcpServers && agent.mcpServers.length > 0 && (
          <div className="p-5 rounded-2xl border border-border bg-surface mb-6">
            <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Server className="h-4 w-4 text-text-secondary" />
              MCP-серверы ({agent.mcpServers.length})
            </h2>
            <div className="space-y-2">
              {agent.mcpServers.map((ams) => (
                <div key={ams.id} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-text-primary">{ams.mcpServer.name}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium",
                    ams.mcpServer.status === "CONNECTED" ? "bg-success/10 text-success" : "bg-error/10 text-error"
                  )}>
                    {ams.mcpServer.status === "CONNECTED" ? "Подключен" : "Отключен"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files */}
        <div className="p-5 rounded-2xl border border-border bg-surface">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary">
              Файлы ({agent.files.length})
            </h2>
            {["CREATING", "ERROR", "READY", "PUBLISHED"].includes(agent.status) && !showUploader && (
              <button
                onClick={() => setShowUploader(true)}
                className="h-8 px-3 rounded-lg bg-accent/10 text-accent text-xs font-medium flex items-center gap-1.5 hover:bg-accent/20 transition-colors cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                Загрузить файлы
              </button>
            )}
          </div>

          {showUploader && (
            <div className="mb-4">
              <FileUploader
                orgId={ids.id}
                agentId={ids.agentId}
                onComplete={handleUploadComplete}
              />
            </div>
          )}

          {agent.files.length === 0 && !showUploader ? (
            <p className="text-sm text-text-secondary">Нет загруженных файлов</p>
          ) : agent.files.length > 0 ? (
            <div className="space-y-2">
              {agent.files.map((file) => (
                <div key={file.id} className="flex items-center gap-3 py-2">
                  <FileText className="h-4 w-4 text-text-secondary shrink-0" />
                  <span className="text-sm text-text-primary truncate flex-1">{file.fileName}</span>
                  <span className="text-xs text-text-secondary shrink-0">{formatSize(file.fileSize)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Удалить агента">
        <div className="flex items-start gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-error/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-error" />
          </div>
          <div>
            <p className="text-sm text-text-primary font-medium">
              Вы уверены, что хотите удалить «{agent.name}»?
            </p>
            <p className="text-xs text-text-secondary mt-1">
              Все данные агента, включая загруженные файлы и обработанные документы, будут безвозвратно удалены.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="h-9 px-4 rounded-xl border border-border text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
          >
            Отмена
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="h-9 px-4 rounded-xl bg-error text-white text-sm font-medium hover:bg-error/90 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {deleting ? "Удаление..." : "Удалить"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    CREATING: { label: "Создание", cls: "bg-accent/10 text-accent" },
    PROCESSING: { label: "Обработка", cls: "bg-warning/10 text-warning" },
    READY: { label: "Готов", cls: "bg-success/10 text-success" },
    PUBLISHED: { label: "Опубликован", cls: "bg-accent/10 text-accent" },
    ERROR: { label: "Ошибка", cls: "bg-error/10 text-error" },
  };
  const c = config[status] || config.CREATING;
  return (
    <span className={cn("px-2.5 py-1 rounded-lg text-xs font-medium", c.cls)}>
      {c.label}
    </span>
  );
}
