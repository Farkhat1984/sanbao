"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Network, MessageSquare, Pencil, Users, Loader2 } from "lucide-react";
import { cn } from "@sanbao/shared/utils";
import { ICON_MAP } from "@sanbao/ui/components/agents/AgentIconPicker";
import { useChatStore } from "@/stores/chatStore";

interface MultiAgentItem {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  iconColor: string | null;
  _count?: { members: number };
  members?: Array<unknown>;
}

export default function OrgMultiAgentsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orgId = params.id;

  const [multiAgents, setMultiAgents] = useState<MultiAgentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!orgId) return;

    const fetchData = async () => {
      try {
        const [orgRes, maRes] = await Promise.all([
          fetch(`/api/organizations/${orgId}`),
          fetch(`/api/organizations/${orgId}/multiagents`),
        ]);

        if (orgRes.ok) {
          const orgData = await orgRes.json();
          const role = orgData.role || orgData.membership?.role;
          setIsAdmin(role === "ADMIN" || role === "OWNER");
        }

        if (maRes.ok) {
          const maData = await maRes.json();
          setMultiAgents(Array.isArray(maData) ? maData : maData.multiAgents || []);
        }
      } catch {
        // Silently fail — empty state will show
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [orgId]);

  const handleStartChat = (multiAgentId: string) => {
    const store = useChatStore.getState();
    store.setActiveConversation(null);
    store.setActiveAgentId(null);
    store.setOrgAgentId(null);
    store.setMessages([]);
    store.setSwarmMode(orgId, multiAgentId);
    router.push("/chat");
  };

  const getMemberCount = (ma: MultiAgentItem): number => {
    if (ma._count?.members != null) return ma._count.members;
    if (Array.isArray(ma.members)) return ma.members.length;
    return 0;
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
            <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">
              Мультиагенты
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Команды агентов для совместной работы
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => router.push(`/organizations/${orgId}/multiagent/new`)}
              className="h-10 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium flex items-center gap-2 hover:shadow-md transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Создать мультиагента
            </button>
          )}
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 animate-pulse">
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-surface-alt" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-surface-alt rounded mb-2" />
                    <div className="h-3 w-48 bg-surface-alt rounded" />
                  </div>
                </div>
                <div className="h-3 w-20 bg-surface-alt rounded mt-3" />
              </div>
            ))}
          </div>
        )}

        {/* Cards grid */}
        {!isLoading && multiAgents.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {multiAgents.map((ma) => {
              const IconComp = ICON_MAP[ma.icon || ""] || Network;
              const color = ma.iconColor || "#f59e0b";
              const memberCount = getMemberCount(ma);

              return (
                <div
                  key={ma.id}
                  className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 transition-all group"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <IconComp className="h-5 w-5" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-text-primary truncate">
                        {ma.name}
                      </h3>
                      {ma.description && (
                        <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                          {ma.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-text-secondary mb-4">
                    <Users className="h-3.5 w-3.5" />
                    <span>
                      {memberCount} {memberCount === 1 ? "агент" : memberCount >= 2 && memberCount <= 4 ? "агента" : "агентов"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartChat(ma.id)}
                      className="h-8 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Начать чат
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => router.push(`/organizations/${orgId}/multiagent/${ma.id}/edit`)}
                        className="h-8 px-3 rounded-lg border border-border text-text-secondary hover:text-text-primary text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Редактировать
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && multiAgents.length === 0 && (
          <div className="text-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-5">
              <Network className="h-8 w-8 text-amber-500" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">Нет мультиагентов</h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
              Создайте команду из нескольких агентов для совместной обработки запросов.
            </p>
            {isAdmin && (
              <button
                onClick={() => router.push(`/organizations/${orgId}/multiagent/new`)}
                className="h-10 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium cursor-pointer"
              >
                Создать мультиагента
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
