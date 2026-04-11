"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MessageSquare,
  FileText,
  Play,
  Rocket,
  RefreshCw,
  Upload,
  Zap,
  Server,
} from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { AgentProgressBar } from "@/components/organizations/AgentProgressBar";
import { FileUploader } from "@/components/organizations/FileUploader";
import { ICON_MAP } from "@sanbao/ui/components/agents/AgentIconPicker";
import { ConfirmModal } from "@sanbao/ui/components/ui/ConfirmModal";
import { Skeleton } from "@sanbao/ui/components/ui/Skeleton";
import { cn } from "@sanbao/shared/utils";

type OrgRole = "OWNER" | "ADMIN" | "MEMBER";

interface OrgAgentDetail {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  icon: string;
  iconColor: string;
  status: string;
  projectId: string | null;
  starterPrompts: string[];
  instructions: string | null;
  mcpServer: {
    id: string;
    name: string;
    status: string;
    discoveredTools: unknown[] | null;
  } | null;
  skills: Array<{
    id: string;
    skill: { id: string; name: string; icon: string; iconColor: string };
  }>;
  mcpServers: Array<{
    id: string;
    mcpServer: { id: string; name: string; url: string; status: string };
  }>;
  files: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    createdAt: string;
  }>;
  fileCount: number;
  conversationCount: number;
  role: OrgRole;
}

export default function OrgAgentDetailPage({
  params,
}: {
  params: Promise<{ id: string; agentId: string }>;
}) {
  const router = useRouter();
  const {
    addConversation,
    setActiveConversation,
    setMessages,
    setActiveAgentId,
    setOrgAgentId,
  } = useChatStore();

  const [agent, setAgent] = useState<OrgAgentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const isAdmin = agent?.role === "OWNER" || agent?.role === "ADMIN";

  const handleStartChat = async () => {
    if (!agent) return;
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Чат с ${agent.name}`,
          orgAgentId: agent.id,
        }),
      });
      if (!res.ok) return;
      const conversation = await res.json();
      addConversation(conversation);
      setActiveConversation(conversation.id);
      setOrgAgentId(agent.id);
      setActiveAgentId(null);
      setMessages([]);
      router.push(`/chat/${conversation.id}`);
    } catch {
      // silent
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/organizations/${ids.id}/agents/${ids.agentId}/process`,
        { method: "POST" }
      );
      if (res.ok) {
        setAgent((a) => (a ? { ...a, status: "PROCESSING" } : a));
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
      const res = await fetch(
        `/api/organizations/${ids.id}/agents/${ids.agentId}/publish`,
        { method: "POST" }
      );
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
      const res = await fetch(
        `/api/organizations/${ids.id}/agents/${ids.agentId}/reprocess`,
        { method: "POST" }
      );
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
      const res = await fetch(
        `/api/organizations/${ids.id}/agents/${ids.agentId}`,
        { method: "DELETE" }
      );
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
    const { id, agentId } = await params;
    try {
      const res = await fetch(`/api/organizations/${id}/agents/${agentId}`);
      const fresh = await res.json();
      if (res.ok) {
        setAgent(fresh);
        if (fresh.status === "CREATING" || fresh.status === "ERROR") {
          handleProcess();
        }
      }
    } catch {
      await loadAgent();
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Skeleton className="h-4 w-20 mb-6" />
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div>
              <Skeleton className="h-7 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-28 w-full rounded-2xl mb-6" />
        <Skeleton className="h-40 w-full rounded-2xl" />
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

  const Icon = ICON_MAP[agent.icon] || ICON_MAP.Bot;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  return (
    <div className="h-full">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Back */}
        <button
          onClick={() => router.push(`/organizations/${ids.id}/agents`)}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Агенты
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: agent.iconColor }}
            >
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">
                {agent.name}
              </h1>
              {agent.description && (
                <p className="text-sm text-text-secondary mt-1">
                  {agent.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {agent.status === "PUBLISHED" && (
              <button
                onClick={handleStartChat}
                className="h-9 px-4 rounded-xl bg-accent text-white text-sm font-medium flex items-center gap-2 hover:bg-accent-hover transition-colors cursor-pointer"
              >
                <MessageSquare className="h-4 w-4" />
                Начать чат
              </button>
            )}
            {isAdmin && (
              <>
                <button
                  onClick={() =>
                    router.push(
                      `/organizations/${ids.id}/agents/${ids.agentId}/edit`
                    )
                  }
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
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-error-light text-error text-sm mb-4">
            {error}
          </div>
        )}

        {/* Info Card */}
        <div className="p-5 rounded-2xl border border-border bg-surface mb-6">
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            Информация
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-text-secondary mb-0.5">Статус</p>
              <StatusBadge status={agent.status} />
            </div>
            <div>
              <p className="text-xs text-text-secondary mb-0.5">Файлы</p>
              <p className="text-sm font-medium text-text-primary tabular-nums">
                {agent.fileCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary mb-0.5">Диалоги</p>
              <p className="text-sm font-medium text-text-primary tabular-nums">
                {agent.conversationCount}
              </p>
            </div>
          </div>
        </div>

        {/* Processing Controls — only ADMIN/OWNER */}
        {isAdmin && (
          <div className="p-5 rounded-2xl border border-border bg-surface mb-6">
            <h2 className="text-sm font-semibold text-text-primary mb-3">
              Управление
            </h2>

            {agent.status === "PROCESSING" && (
              <AgentProgressBar
                orgId={ids.id}
                agentId={ids.agentId}
                onComplete={async () => {
                  try {
                    await fetch(
                      `/api/organizations/${ids.id}/agents/${ids.agentId}`,
                      {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "READY" }),
                      }
                    );
                  } catch {
                    // Non-critical
                  }
                  await loadAgent();
                }}
              />
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              {(agent.status === "CREATING" || agent.status === "ERROR") &&
                agent.files.length > 0 && (
                  <button
                    onClick={handleProcess}
                    disabled={processing}
                    className="h-9 px-4 rounded-xl bg-warning text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Play className="h-4 w-4" />
                    {processing ? "Запуск..." : "Обработать"}
                  </button>
                )}

              {(agent.status === "READY" ||
                agent.status === "PROCESSING") && (
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
                  <RefreshCw
                    className={cn(
                      "h-4 w-4",
                      reprocessing && "animate-spin"
                    )}
                  />
                  {reprocessing ? "Переобработка..." : "Переобработать"}
                </button>
              )}

              {agent.status === "CREATING" &&
                agent.files.length === 0 && (
                  <p className="text-xs text-text-secondary">
                    Загрузите файлы, чтобы начать обработку
                  </p>
                )}
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
                    style={{
                      backgroundColor: `${as.skill.iconColor}20`,
                      color: as.skill.iconColor,
                    }}
                  >
                    {as.skill.icon?.charAt(0) || "S"}
                  </span>
                  <span className="text-sm text-text-primary">
                    {as.skill.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MCP Servers */}
        {agent.mcpServers && agent.mcpServers.length > 0 && (
          <div className="p-5 rounded-2xl border border-border bg-surface mb-6">
            <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Server className="h-4 w-4 text-text-secondary" />
              MCP-серверы ({agent.mcpServers.length})
            </h2>
            <div className="space-y-2">
              {agent.mcpServers.map((ams) => (
                <div
                  key={ams.id}
                  className="flex items-center justify-between py-1.5"
                >
                  <span className="text-sm text-text-primary">
                    {ams.mcpServer.name}
                  </span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium",
                      ams.mcpServer.status === "CONNECTED"
                        ? "bg-success/10 text-success"
                        : "bg-error/10 text-error"
                    )}
                  >
                    {ams.mcpServer.status === "CONNECTED"
                      ? "Подключен"
                      : "Отключен"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MCP Tools */}
        {agent.mcpServer &&
          agent.mcpServer.discoveredTools &&
          (
            agent.mcpServer.discoveredTools as Array<{
              name: string;
              description: string;
            }>
          ).length > 0 && (
            <div className="p-5 rounded-2xl border border-border bg-surface mb-6">
              <h2 className="text-sm font-semibold text-text-primary mb-3">
                Инструменты MCP
              </h2>
              <div className="space-y-1">
                {(
                  agent.mcpServer.discoveredTools as Array<{
                    name: string;
                    description: string;
                  }>
                ).map((tool) => (
                  <div
                    key={tool.name}
                    className="flex items-start gap-2 py-1.5"
                  >
                    <code className="text-xs bg-surface-alt px-1.5 py-0.5 rounded font-mono text-accent shrink-0">
                      {tool.name}
                    </code>
                    <span className="text-xs text-text-secondary">
                      {tool.description}
                    </span>
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

        {/* Files */}
        <div className="p-5 rounded-2xl border border-border bg-surface">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary">
              Файлы ({agent.files.length})
            </h2>
            {isAdmin &&
              ["CREATING", "ERROR", "READY", "PUBLISHED"].includes(
                agent.status
              ) &&
              !showUploader && (
                <button
                  onClick={() => setShowUploader(true)}
                  className="h-8 px-3 rounded-lg bg-accent/10 text-accent text-xs font-medium flex items-center gap-1.5 hover:bg-accent/20 transition-colors cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Загрузить файлы
                </button>
              )}
          </div>

          {isAdmin && showUploader && (
            <div className="mb-4">
              <FileUploader
                orgId={ids.id}
                agentId={ids.agentId}
                onComplete={handleUploadComplete}
              />
            </div>
          )}

          {agent.files.length === 0 && !showUploader ? (
            <p className="text-sm text-text-secondary">
              Нет загруженных файлов
            </p>
          ) : agent.files.length > 0 ? (
            <div className="space-y-2">
              {agent.files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 py-2"
                >
                  <FileText className="h-4 w-4 text-text-secondary shrink-0" />
                  <span className="text-sm text-text-primary truncate flex-1">
                    {file.fileName}
                  </span>
                  <span className="text-xs text-text-secondary shrink-0">
                    {formatSize(file.fileSize)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title={`Удалить «${agent.name}»?`}
        description="Все данные агента, включая загруженные файлы и обработанные документы, будут безвозвратно удалены."
        confirmText={deleting ? "Удаление..." : "Удалить"}
        variant="danger"
      />
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
