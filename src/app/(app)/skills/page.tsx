"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Zap, Store, Sparkles, Loader2, Search, TrendingUp, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSkillStore } from "@/stores/skillStore";
import { SkillCard } from "@/components/skills/SkillCard";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { SKILL_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import type { Skill } from "@/types/skill";

const SKILLS_LIMIT = 20;

export default function SkillsPage() {
  const router = useRouter();
  const { setSkills, setLoading, categoryFilter, sortBy, setCategoryFilter, setSortBy } = useSkillStore();
  const [skills, setLocalSkills] = useState<Skill[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Infinite scroll state
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Build query params
  const buildParams = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams({ limit: String(SKILLS_LIMIT) });
      if (cursor) params.set("cursor", cursor);
      if (categoryFilter) params.set("category", categoryFilter);
      if (sortBy === "popular") params.set("sort", "popular");
      return params.toString();
    },
    [categoryFilter, sortBy],
  );

  // Initial fetch (re-run when filters change)
  useEffect(() => {
    setIsLoading(true);
    setLocalSkills([]);
    setNextCursor(null);
    setHasMore(false);

    fetch(`/api/skills?${buildParams()}`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.items ?? [];
        setLocalSkills(list);
        setSkills(list);
        setNextCursor(data.nextCursor ?? null);
        setHasMore(!!data.nextCursor);
      })
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
        setLoaded(true);
        setLoading(false);
      });
  }, [setSkills, setLoading, buildParams]);

  // Load more skills
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    fetch(`/api/skills?${buildParams(nextCursor)}`)
      .then((res) => res.json())
      .then((data) => {
        const newItems = Array.isArray(data) ? data : data.items ?? [];
        setLocalSkills((prev) => {
          const merged = [...prev, ...newItems];
          setSkills(merged);
          return merged;
        });
        setNextCursor(data.nextCursor ?? null);
        setHasMore(!!data.nextCursor);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, nextCursor, setSkills, buildParams]);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    loading: loadingMore,
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const normalizedQuery = searchQuery.toLowerCase().trim();

  const builtIn = useMemo(
    () =>
      skills.filter(
        (s) =>
          s.isBuiltIn &&
          (!normalizedQuery ||
            s.name.toLowerCase().includes(normalizedQuery) ||
            (s.description ?? "").toLowerCase().includes(normalizedQuery)),
      ),
    [skills, normalizedQuery],
  );

  const custom = useMemo(
    () =>
      skills.filter(
        (s) =>
          !s.isBuiltIn &&
          (!normalizedQuery ||
            s.name.toLowerCase().includes(normalizedQuery) ||
            (s.description ?? "").toLowerCase().includes(normalizedQuery)),
      ),
    [skills, normalizedQuery],
  );

  const hasNoResults =
    loaded &&
    normalizedQuery.length > 0 &&
    builtIn.length === 0 &&
    custom.length === 0;

  async function handleDeleteConfirm() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await fetch(`/api/skills/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLocalSkills((prev) => prev.filter((s) => s.id !== id));
    }
  }

  return (
    <div className="h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">Скиллы</h1>
            <p className="text-sm text-text-secondary mt-1">
              Модульные юридические навыки для AI-ассистента
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/skills/marketplace")}
              className="h-10 px-4 rounded-xl border border-border text-text-secondary text-sm font-medium flex items-center gap-2 hover:border-border-hover transition-all cursor-pointer"
            >
              <Store className="h-4 w-4" />
              Маркетплейс
            </button>
            <button
              onClick={() => router.push("/skills/new")}
              className="h-10 px-5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Создать скилл
            </button>
          </div>
        </div>

        {/* Category filter tabs + Sort toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex-1 overflow-x-auto scrollbar-none">
            <div className="flex gap-1">
              <button
                onClick={() => setCategoryFilter(null)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                  categoryFilter === null
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:bg-surface-alt",
                )}
              >
                Все
              </button>
              {SKILL_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategoryFilter(cat.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                    categoryFilter === cat.value
                      ? "bg-accent text-white"
                      : "text-text-secondary hover:bg-surface-alt",
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 bg-surface-alt rounded-lg p-0.5 border border-border">
            <button
              onClick={() => setSortBy("newest")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                sortBy === "newest"
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              <Clock className="h-3 w-3" />
              Новые
            </button>
            <button
              onClick={() => setSortBy("popular")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                sortBy === "popular"
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              <TrendingUp className="h-3 w-3" />
              Популярные
            </button>
          </div>
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

        {isLoading && !loaded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4].map((i) => (
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
        )}

        {loaded && (
          <>
            {builtIn.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2.5 mb-4">
                  <Zap className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Встроенные</h2>
                  <span className="text-xs text-text-secondary tabular-nums">{builtIn.length}</span>
                  <div className="flex-1 h-px bg-border ml-2" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {builtIn.map((skill) => (
                    <SkillCard key={skill.id} skill={skill} />
                  ))}
                </div>
              </div>
            )}

            {custom.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2.5 mb-4">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Мои скиллы</h2>
                  <span className="text-xs text-text-secondary tabular-nums">{custom.length}</span>
                  <div className="flex-1 h-px bg-border ml-2" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {custom.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      isOwner
                      onDelete={(id) => setDeleteId(id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Infinite scroll sentinel */}
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

            {skills.length === 0 && !normalizedQuery && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20"
              >
                <div className="h-16 w-16 rounded-2xl bg-surface-alt flex items-center justify-center mx-auto mb-5">
                  <Zap className="h-8 w-8 text-text-secondary" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary mb-2">
                  Нет скиллов
                </h2>
                <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
                  Создайте свой первый юридический скилл или загляните в маркетплейс
                </p>
              </motion.div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
        title="Удалить скилл?"
        description="Скилл будет удалён. Агенты, использующие этот скилл, потеряют его."
        confirmText="Удалить"
      />
    </div>
  );
}
