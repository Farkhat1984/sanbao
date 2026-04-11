"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MessageSquare,
  Users,
} from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { AgentAccessSection } from "@sanbao/ui/components/agents/AgentAccessSection";
import { ICON_MAP } from "@sanbao/ui/components/agents/AgentIconPicker";
import { ConfirmModal } from "@sanbao/ui/components/ui/ConfirmModal";
import { Skeleton } from "@sanbao/ui/components/ui/Skeleton";

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
    extractedText?: string | null;
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ids, setIds] = useState({ id: "", agentId: "" });

  const loadAgent = useCallback(async () => {
    const { id, agentId } = await params;
    setIds({ id, agentId });
    try {
      const res = await fetch(`/api/organizations/${id}/agents/${agentId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setAgent(data);
      }
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

  if (isLoading) {
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

  const Icon = ICON_MAP[agent.icon] || ICON_MAP.Bot;

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
            <button
              onClick={handleStartChat}
              className="h-9 px-4 rounded-xl bg-accent text-white text-sm font-medium flex items-center gap-2 hover:bg-accent-hover transition-colors cursor-pointer"
            >
              <MessageSquare className="h-4 w-4" />
              Начать чат
            </button>
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

        {/* Access Management — only section unique to org agents */}
        {isAdmin && (
          <div className="p-5 rounded-2xl border border-border bg-surface mb-6">
            <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-text-secondary" />
              Доступ
            </h2>
            <AgentAccessSection
              accessPath={`/api/organizations/${ids.id}/agents/${ids.agentId}/access`}
              membersPath={`/api/organizations/${ids.id}/members`}
              entityLabel="агенту"
            />
          </div>
        )}
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
