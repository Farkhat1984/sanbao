"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MessageSquare,
  FileText,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
} from "lucide-react";
import { useChatStore } from "@sanbao/stores/chatStore";
import { AgentFileUpload } from "@sanbao/ui/components/agents/AgentFileUpload";
import { ICON_MAP } from "@sanbao/ui/components/agents/AgentIconPicker";
import { ConfirmModal } from "@sanbao/ui/components/ui/ConfirmModal";
import { Skeleton } from "@sanbao/ui/components/ui/Skeleton";
import { cn } from "@sanbao/shared/utils";
import type { Agent, AgentFile } from "@/types/agent";

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addConversation, setActiveConversation, setMessages, setActiveAgentId } =
    useChatStore();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadAgent = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${id}`);
      if (!res.ok) throw new Error("Агент не найден");
      const data = await res.json();
      setAgent(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  const handleStartChat = async () => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Чат с ${agent?.name}`,
          agentId: id,
        }),
      });

      if (!res.ok) return;

      const conversation = await res.json();
      addConversation(conversation);
      setActiveConversation(conversation.id);
      setActiveAgentId(id);
      setMessages([]);
      router.push(`/chat/${conversation.id}`);
    } catch {
      // silent
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/agents");
      } else {
        const data = await res.json();
        setError(data.error || "Ошибка удаления");
      }
    } catch {
      setError("Ошибка удаления");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleFileAdded = (file: AgentFile) => {
    setAgent((prev) =>
      prev ? { ...prev, files: [...prev.files, file] } : prev
    );
  };

  const handleFileRemoved = (fileId: string) => {
    setAgent((prev) =>
      prev
        ? { ...prev, files: prev.files.filter((f) => f.id !== fileId) }
        : prev
    );
  };

  const handleFileUpdated = (file: AgentFile) => {
    setAgent((prev) =>
      prev
        ? {
            ...prev,
            files: prev.files.map((f) => (f.id === file.id ? file : f)),
          }
        : prev
    );
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Skeleton className="h-4 w-20 mb-6" />
        <div className="flex items-start justify-between mb-6">
          <div>
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-28 w-full rounded-2xl mb-6" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 text-center">
        <p className="text-text-secondary">{error || "Агент не найден"}</p>
      </div>
    );
  }

  // System agents are read-only — no edit/delete
  const isOwned = !agent.isSystem;

  const Icon = ICON_MAP[agent.icon] || ICON_MAP.Bot;

  const filesWithText = agent.files.filter(
    (f) => f.extractedText && !f.fileType?.startsWith("image/")
  );
  const filesWithoutText = agent.files.filter(
    (f) => !f.extractedText && !f.fileType?.startsWith("image/")
  );
  const imageFiles = agent.files.filter((f) =>
    f.fileType?.startsWith("image/")
  );

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
          onClick={() => router.push("/agents")}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Агенты
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            {agent.avatar ? (
              <img
                src={agent.avatar}
                alt={agent.name}
                className="h-12 w-12 rounded-xl object-cover shrink-0"
              />
            ) : (
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: agent.iconColor }}
              >
                <Icon className="h-6 w-6 text-white" />
              </div>
            )}
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
            <button
              onClick={handleStartChat}
              className="h-9 px-4 rounded-xl bg-accent text-white text-sm font-medium flex items-center gap-2 hover:bg-accent-hover transition-colors cursor-pointer"
            >
              <MessageSquare className="h-4 w-4" />
              Начать чат
            </button>
            {isOwned && (
              <>
                <button
                  onClick={() => router.push(`/agents/${id}/edit`)}
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

        {/* Status Card */}
        <div className="p-5 rounded-2xl border border-border bg-surface mb-6">
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            Информация
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-text-secondary mb-0.5">Файлы</p>
              <p className="text-sm font-medium text-text-primary tabular-nums">
                {agent.files.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary mb-0.5">
                Текст извлечён
              </p>
              <p className="text-sm font-medium text-text-primary tabular-nums">
                {filesWithText.length} / {agent.files.length - imageFiles.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary mb-0.5">Модель</p>
              <p className="text-sm font-medium text-text-primary truncate">
                {agent.model}
              </p>
            </div>
          </div>

          {/* File extraction status summary */}
          {agent.files.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex flex-wrap gap-3 text-xs">
                {filesWithText.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    {filesWithText.length} извлечён{filesWithText.length === 1 ? "" : "о"}
                  </span>
                )}
                {filesWithoutText.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <AlertCircle className="h-3 w-3" />
                    {filesWithoutText.length} без текста
                  </span>
                )}
                {imageFiles.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-text-secondary">
                    <ImageIcon className="h-3 w-3" />
                    {imageFiles.length} изображен{imageFiles.length === 1 ? "ие" : "ий"}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Skills */}
        {agent.skills && agent.skills.length > 0 && (
          <div className="p-5 rounded-2xl border border-border bg-surface mb-6">
            <h2 className="text-sm font-semibold text-text-primary mb-3">
              Скиллы
            </h2>
            <div className="flex flex-wrap gap-2">
              {agent.skills.map((as) => (
                <span
                  key={as.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/10 text-accent text-xs font-medium"
                >
                  {as.skill.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* MCP Servers */}
        {agent.mcpServers && agent.mcpServers.length > 0 && (
          <div className="p-5 rounded-2xl border border-border bg-surface mb-6">
            <h2 className="text-sm font-semibold text-text-primary mb-3">
              MCP серверы
            </h2>
            <div className="space-y-2">
              {agent.mcpServers.map((ams) => (
                <div
                  key={ams.id}
                  className="flex items-center gap-2 py-1.5"
                >
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      ams.mcpServer.status === "CONNECTED"
                        ? "bg-success"
                        : "bg-text-muted"
                    )}
                  />
                  <span className="text-sm text-text-primary">
                    {ams.mcpServer.name}
                  </span>
                  <span className="text-xs text-text-secondary truncate">
                    {ams.mcpServer.url}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files */}
        <div className="p-5 rounded-2xl border border-border bg-surface">
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            Файлы знаний ({agent.files.length})
          </h2>

          {/* AgentFileUpload renders both the file list and the dropzone */}
          {isOwned ? (
            <AgentFileUpload
              agentId={id}
              files={agent.files}
              onFileAdded={handleFileAdded}
              onFileRemoved={handleFileRemoved}
              onFileUpdated={handleFileUpdated}
            />
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
          ) : (
            <p className="text-sm text-text-secondary">
              Нет загруженных файлов
            </p>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title={`Удалить «${agent.name}»?`}
        description="Все данные агента, включая загруженные файлы и историю чатов, будут безвозвратно удалены."
        confirmText={deleting ? "Удаление..." : "Удалить"}
        variant="danger"
      />
    </div>
  );
}
