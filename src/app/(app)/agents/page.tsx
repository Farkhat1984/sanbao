"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Bot, Sparkles, Loader2 } from "lucide-react";
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

const USER_AGENTS_LIMIT = 20;

export default function AgentsPage() {
  const router = useRouter();
  const { agents, setAgents, isLoading, setLoading } = useAgentStore();
  const [loaded, setLoaded] = useState(false);
  const [systemAgents, setSystemAgents] = useState<SystemAgentInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Infinite scroll state for user agents
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    fetch(`/api/agents?limit=${USER_AGENTS_LIMIT}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.systemAgents) setSystemAgents(data.systemAgents);
        if (data.userAgents) setAgents(data.userAgents);
        setNextCursor(data.nextCursor ?? null);
        setHasMore(data.hasMore ?? false);
      })
      .catch(console.error)
      .finally(() => {
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

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

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
    filteredUserAgents.length === 0;

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
