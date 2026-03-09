"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Bot, Sparkles, Loader2, Building2, MessageSquare, Network, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAgentStore } from "@sanbao/stores/agentStore";
import { useChatStore } from "@sanbao/stores/chatStore";
import { AgentCard } from "@sanbao/ui/components/agents/AgentCard";
import { SystemAgentCard } from "@sanbao/ui/components/agents/SystemAgentCard";
import { ICON_MAP } from "@sanbao/ui/components/agents/AgentIconPicker";
import { Skeleton } from "@sanbao/ui/components/ui/Skeleton";
import { useInfiniteScroll } from "@sanbao/ui/hooks/useInfiniteScroll";

interface SystemAgentInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconColor: string;
  isSystem: boolean;
}

interface OrgAgentItem {
  id: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  name: string;
  description: string | null;
  status: string;
  icon: string | null;
  iconColor: string | null;
  mcpServer: { url: string } | null;
}

interface MultiAgentItem {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  icon: string | null;
  iconColor: string | null;
  members: Array<{ agentType: string; agentId: string }>;
}

const USER_AGENTS_LIMIT = 20;

export default function AgentsPage() {
  const router = useRouter();
  const { agents, setAgents, isLoading, setLoading } = useAgentStore();
  const { addConversation, setActiveConversation, setMessages, setActiveAgentId, setOrgAgentId, setSwarmMode } =
    useChatStore();
  const [loaded, setLoaded] = useState(false);
  const [systemAgents, setSystemAgents] = useState<SystemAgentInfo[]>([]);
  const [orgAgents, setOrgAgents] = useState<OrgAgentItem[]>([]);
  const [multiAgents, setMultiAgents] = useState<MultiAgentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Infinite scroll state for user agents
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Initial fetch
  useEffect(() => {
    setLoading(true);

    const agentsFetch = fetch(`/api/agents?limit=${USER_AGENTS_LIMIT}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.systemAgents) setSystemAgents(data.systemAgents);
        if (data.userAgents) setAgents(data.userAgents);
        setNextCursor(data.nextCursor ?? null);
        setHasMore(data.hasMore ?? false);
      });

    const orgFetch = fetch("/api/organizations/my-agents")
      .then((r) => r.json())
      .then(async (data) => {
        if (Array.isArray(data)) {
          setOrgAgents(data);
          // Fetch multi-agents for each unique org
          const orgIds = [...new Set(data.map((a: OrgAgentItem) => a.orgId))];
          const allMultiAgents: MultiAgentItem[] = [];
          await Promise.allSettled(
            orgIds.map((orgId) =>
              fetch(`/api/organizations/${orgId}/multiagents`)
                .then((r) => r.json())
                .then((maData) => {
                  if (Array.isArray(maData)) {
                    for (const ma of maData) {
                      allMultiAgents.push({ ...ma, orgId });
                    }
                  }
                }),
            ),
          );
          setMultiAgents(allMultiAgents);
        }
      })
      .catch(() => {
        // Org agents are optional — silently ignore failures
      });

    Promise.allSettled([agentsFetch, orgFetch]).finally(() => {
      setLoading(false);
      setLoaded(true);
    });
  }, [setAgents, setLoading]);

  // Load more user agents
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    fetch(`/api/agents?type=user&limit=${USER_AGENTS_LIMIT}&cursor=${nextCursor}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.userAgents) {
          setAgents([...agents, ...data.userAgents]);
        }
        setNextCursor(data.nextCursor ?? null);
        setHasMore(data.hasMore ?? false);
      })
      .catch(console.error)
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, nextCursor, agents, setAgents]);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    loading: loadingMore,
  });

  const normalizedQuery = searchQuery.toLowerCase().trim();

  const filteredSystemAgents = useMemo(
    () =>
      systemAgents.filter(
        (a) =>
          !normalizedQuery ||
          a.name.toLowerCase().includes(normalizedQuery) ||
          a.description.toLowerCase().includes(normalizedQuery),
      ),
    [systemAgents, normalizedQuery],
  );

  const filteredOrgAgents = useMemo(
    () =>
      orgAgents.filter(
        (a) =>
          !normalizedQuery ||
          a.name.toLowerCase().includes(normalizedQuery) ||
          (a.description ?? "").toLowerCase().includes(normalizedQuery) ||
          a.orgName.toLowerCase().includes(normalizedQuery),
      ),
    [orgAgents, normalizedQuery],
  );

  const orgAgentsByOrg = useMemo(() => {
    const grouped = new Map<string, { orgName: string; agents: OrgAgentItem[] }>();
    for (const agent of filteredOrgAgents) {
      const existing = grouped.get(agent.orgId);
      if (existing) {
        existing.agents.push(agent);
      } else {
        grouped.set(agent.orgId, { orgName: agent.orgName, agents: [agent] });
      }
    }
    return grouped;
  }, [filteredOrgAgents]);

  const filteredUserAgents = useMemo(
    () =>
      agents.filter(
        (a) =>
          !normalizedQuery ||
          a.name.toLowerCase().includes(normalizedQuery) ||
          (a.description ?? "").toLowerCase().includes(normalizedQuery),
      ),
    [agents, normalizedQuery],
  );

  const hasNoResults =
    loaded &&
    normalizedQuery.length > 0 &&
    filteredSystemAgents.length === 0 &&
    filteredOrgAgents.length === 0 &&
    filteredUserAgents.length === 0;

  const handleMultiAgentChat = (orgId: string, multiAgentId: string) => {
    setActiveConversation(null);
    setActiveAgentId(null);
    setOrgAgentId(null);
    setMessages([]);
    setSwarmMode(orgId, multiAgentId);
    router.push("/chat");
  };

  const handleOrgAgentChat = async (agent: OrgAgentItem) => {
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
      setActiveAgentId(null);
      setOrgAgentId(agent.id);
      setMessages([]);
      router.push(`/chat/${conversation.id}`);
    } catch {
      // Ignore errors
    }
  };

  return (
    <div className="h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">
              Агенты
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Системные и персональные AI-ассистенты
            </p>
          </div>
          <button
            onClick={() => router.push("/agents/new")}
            className="h-10 px-5 rounded-2xl bg-accent hover:bg-accent-hover text-white text-sm font-medium flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Создать агента
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по имени или описанию..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
          />
        </div>

        {/* Loading */}
        {isLoading && !loaded && (
          <div className="space-y-8">
            <div>
              <Skeleton className="h-4 w-40 mb-4" />
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
            </div>
          </div>
        )}

        {loaded && (
          <div className="space-y-8">
            {/* System Agents Section */}
            {filteredSystemAgents.length > 0 && (
              <section>
                <div className="flex items-center gap-2.5 mb-4">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">
                    Системные
                  </h2>
                  <span className="text-xs text-text-secondary tabular-nums">
                    {filteredSystemAgents.length}
                  </span>
                  <div className="flex-1 h-px bg-border ml-2" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSystemAgents.map((agent) => (
                    <SystemAgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
              </section>
            )}

            {/* Organization Agents Section */}
            {filteredOrgAgents.length > 0 && (
              <section>
                <div className="flex items-center gap-2.5 mb-4">
                  <Building2 className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">
                    Организации
                  </h2>
                  <span className="text-xs text-text-secondary tabular-nums">
                    {filteredOrgAgents.length}
                  </span>
                  <div className="flex-1 h-px bg-border ml-2" />
                </div>

                <div className="space-y-6">
                  {Array.from(orgAgentsByOrg.entries()).map(([orgId, { orgName, agents: orgGroupAgents }]) => (
                    <div key={orgId}>
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="h-3.5 w-3.5 text-text-secondary" />
                        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                          {orgName}
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Custom Multi-Agent cards */}
                        {multiAgents
                          .filter((ma) => ma.orgId === orgId)
                          .map((ma) => {
                            const MaIcon = (ma.icon && ICON_MAP[ma.icon]) || Network;
                            return (
                              <motion.div
                                key={ma.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="relative p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 transition-all duration-200 hover:border-amber-500/40 hover:shadow-sm"
                              >
                                <div className="flex items-start gap-3 mb-3">
                                  <div
                                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-md"
                                    style={{ backgroundColor: ma.iconColor || "#f59e0b" }}
                                  >
                                    <MaIcon className="h-5 w-5 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-semibold text-text-primary truncate">
                                      {ma.name}
                                    </h3>
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                      {ma.members.length} агентов
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => router.push(`/organizations/${orgId}/multiagent/${ma.id}/edit`)}
                                    className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
                                    title="Редактировать"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </div>

                                <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-4">
                                  {ma.description || "Команда агентов для совместной работы"}
                                </p>

                                <div className="flex items-center justify-between pt-3 border-t border-amber-500/20">
                                  <div className="flex items-center gap-1 text-[10px] text-text-secondary">
                                    <Network className="h-3 w-3 text-amber-500" />
                                    {orgName}
                                  </div>
                                  <button
                                    onClick={() => handleMultiAgentChat(orgId, ma.id)}
                                    className="h-7 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors cursor-pointer"
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <MessageSquare className="h-3 w-3" />
                                      Начать чат
                                    </span>
                                  </button>
                                </div>
                              </motion.div>
                            );
                          })}
                        {orgGroupAgents.map((agent) => {
                          const Icon = (agent.icon && ICON_MAP[agent.icon]) || ICON_MAP.Bot || Bot;
                          return (
                            <motion.div
                              key={agent.id}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="relative p-5 rounded-2xl border border-border bg-surface transition-all duration-200"
                            >
                              {/* Org badge */}
                              <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                                <Building2 className="h-2.5 w-2.5" />
                                <span className="text-[9px] font-semibold uppercase tracking-wider truncate max-w-[80px]">
                                  {orgName}
                                </span>
                              </div>

                              <div className="flex items-start gap-3 mb-3">
                                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-md bg-accent">
                                  <Icon className="h-5 w-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-sm font-semibold text-text-primary truncate">
                                    {agent.name}
                                  </h3>
                                  <p className="text-xs text-accent/70 mt-0.5">
                                    Агент организации
                                  </p>
                                </div>
                              </div>

                              <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-4">
                                {agent.description || "Без описания"}
                              </p>

                              <div className="flex items-center justify-between pt-3 border-t border-accent/20">
                                <div className="flex items-center gap-1 text-[10px] text-text-secondary">
                                  <Building2 className="h-3 w-3" />
                                  {orgName}
                                </div>
                                <button
                                  onClick={() => handleOrgAgentChat(agent)}
                                  className="h-7 px-3 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors cursor-pointer"
                                >
                                  <span className="flex items-center gap-1.5">
                                    <MessageSquare className="h-3 w-3" />
                                    Начать чат
                                  </span>
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* User Agents Section */}
            <section>
              <div className="flex items-center gap-2.5 mb-4">
                <Bot className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">
                  Мои агенты
                </h2>
                <span className="text-xs text-text-secondary tabular-nums">
                  {filteredUserAgents.length}
                </span>
                <div className="flex-1 h-px bg-border ml-2" />
              </div>

              {filteredUserAgents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredUserAgents.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
              ) : (
                !normalizedQuery && (
                  <div className="flex flex-col items-center justify-center py-12 px-4 rounded-2xl border border-dashed border-border bg-surface/50">
                    <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                      <Bot className="h-6 w-6 text-accent" />
                    </div>
                    <p className="text-sm font-medium text-text-primary mb-1">
                      У вас пока нет агентов
                    </p>
                    <p className="text-sm text-text-secondary text-center max-w-xs">
                      Создайте персонального агента с уникальными инструкциями и файлами знаний
                    </p>
                  </div>
                )
              )}

              {/* Infinite scroll sentinel + loading indicator */}
              {hasMore && !normalizedQuery && (
                <div ref={sentinelRef} className="flex items-center justify-center py-8">
                  {loadingMore && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Загрузка...</span>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* No search results */}
            {hasNoResults && (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="h-12 w-12 rounded-xl bg-surface flex items-center justify-center mb-4 border border-border">
                  <Search className="h-6 w-6 text-text-secondary" />
                </div>
                <p className="text-sm font-medium text-text-primary mb-1">
                  Ничего не найдено
                </p>
                <p className="text-sm text-text-secondary">
                  Попробуйте изменить поисковый запрос
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
