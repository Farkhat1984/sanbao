"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Bot, FileText, Loader2, MessageSquare, Pencil } from "lucide-react";
import { useInfiniteScroll } from "@sanbao/ui/hooks/useInfiniteScroll";
import { useChatStore } from "@/stores/chatStore";

interface OrgAgentItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  fileCount: number;
  createdAt: string;
}

const ORG_AGENTS_LIMIT = 20;

export default function OrgAgentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [agents, setAgents] = useState<OrgAgentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orgId, setOrgId] = useState("");
  const [role, setRole] = useState<string>("");

  // Infinite scroll state
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    params.then(({ id }) => {
      setOrgId(id);
      fetch(`/api/organizations/${id}/agents?limit=${ORG_AGENTS_LIMIT}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.agents) {
            setAgents(data.agents);
            setNextCursor(data.nextCursor ?? null);
            setHasMore(data.hasMore ?? false);
          } else if (Array.isArray(data)) {
            // Backward compat: old API returned plain array
            setAgents(data);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
      // Fetch role
      fetch(`/api/organizations/${id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.role) setRole(data.role);
        })
        .catch(() => {});
    });
  }, [params]);

  // Load more agents
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !nextCursor || !orgId) return;
    setLoadingMore(true);
    fetch(`/api/organizations/${orgId}/agents?limit=${ORG_AGENTS_LIMIT}&cursor=${nextCursor}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.agents) {
          setAgents((prev) => [...prev, ...data.agents]);
          setNextCursor(data.nextCursor ?? null);
          setHasMore(data.hasMore ?? false);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, nextCursor, orgId]);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    loading: loadingMore,
  });

  const isAdmin = role === "OWNER" || role === "ADMIN";

  const handleStartChat = async (agentId: string, agentName: string) => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Чат с ${agentName}`,
          orgAgentId: agentId,
        }),
      });
      if (!res.ok) return;
      const conversation = await res.json();
      const store = useChatStore.getState();
      store.addConversation(conversation);
      store.setActiveConversation(conversation.id);
      store.setOrgAgentId(agentId);
      store.setActiveAgentId(null);
      store.setMessages([]);
      router.push(`/chat/${conversation.id}`);
    } catch {
      // silent
    }
  };

  return (
    <div className="h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => router.push(`/organizations/${orgId}`)}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">AI-агенты</h1>
            <p className="text-sm text-text-secondary mt-1">
              Агенты, созданные из ваших документов
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => router.push(`/organizations/${orgId}/agents/new`)}
              className="h-10 px-5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium flex items-center gap-2 hover:shadow-md transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Создать агента
            </button>
          )}
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
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="p-5 rounded-2xl border border-border bg-surface transition-all group"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                        <Bot className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-text-primary truncate">
                          {agent.name}
                        </h3>
                        {agent.description && (
                          <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{agent.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-secondary mb-4">
                      <FileText className="h-3.5 w-3.5" />
                      <span>{agent.fileCount} файл(ов)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartChat(agent.id, agent.name)}
                        className="h-8 px-4 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Начать чат
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => router.push(`/organizations/${orgId}/agents/${agent.id}/edit`)}
                          className="h-8 px-3 rounded-lg border border-border text-text-secondary hover:text-text-primary text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Редактировать
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-8">
                {loadingMore && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Загрузка...</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!isLoading && agents.length === 0 && (
          <div className="text-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-surface-alt flex items-center justify-center mx-auto mb-5">
              <Bot className="h-8 w-8 text-text-secondary" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">Нет агентов</h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
              {isAdmin
                ? "Создайте AI-агента, загрузив документы вашей организации."
                : "В этой организации пока нет агентов."}
            </p>
            {isAdmin && (
              <button
                onClick={() => router.push(`/organizations/${orgId}/agents/new`)}
                className="h-10 px-6 rounded-xl bg-accent text-white text-sm font-medium cursor-pointer"
              >
                Создать агента
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
