"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Database, Loader2, Search } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useIntegrationStore } from "@sanbao/stores/integrationStore";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { ConfirmModal } from "@sanbao/ui/components/ui/ConfirmModal";
import { Skeleton } from "@sanbao/ui/components/ui/Skeleton";
import { useInfiniteScroll } from "@sanbao/ui/hooks/useInfiniteScroll";
import type { IntegrationSummary } from "@/types/integration";

const LIMIT = 20;

export default function IntegrationsPage() {
  const router = useRouter();
  const { setIntegrations, setLoading } = useIntegrationStore();
  const [items, setItems] = useState<IntegrationSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchItems = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams({ limit: String(LIMIT) });
      if (cursor) params.set("cursor", cursor);
      return fetch(`/api/integrations?${params.toString()}`).then((r) => r.json());
    },
    [],
  );

  useEffect(() => {
    setIsLoading(true);
    fetchItems()
      .then((data) => {
        const list = data.items || [];
        setItems(list);
        setIntegrations(list);
        setNextCursor(data.nextCursor ?? null);
        setHasMore(!!data.nextCursor);
      })
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
        setLoaded(true);
        setLoading(false);
      });
  }, [setIntegrations, setLoading, fetchItems]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    fetchItems(nextCursor)
      .then((data) => {
        const newItems = data.items || [];
        setItems((prev) => {
          const merged = [...prev, ...newItems];
          setIntegrations(merged);
          return merged;
        });
        setNextCursor(data.nextCursor ?? null);
        setHasMore(!!data.nextCursor);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, nextCursor, setIntegrations, fetchItems]);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    loading: loadingMore,
  });

  const normalizedQuery = searchQuery.toLowerCase().trim();
  const filtered = items.filter(
    (i) =>
      !normalizedQuery ||
      i.name.toLowerCase().includes(normalizedQuery) ||
      i.baseUrl.toLowerCase().includes(normalizedQuery),
  );

  async function handleDiscover(id: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: "DISCOVERING" } : i));
    try {
      const res = await fetch(`/api/integrations/${id}/discover`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...data, status: data.status } : i));
      } else {
        setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: "ERROR", statusMessage: data.error } : i));
      }
    } catch {
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: "ERROR" } : i));
    }
  }

  function handleReconnect(id: string) {
    router.push(`/integrations/${id}/edit`);
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await fetch(`/api/integrations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  }

  return (
    <div className="h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">Интеграции</h1>
            <p className="text-sm text-text-secondary mt-1">
              Подключения к внешним системам для обмена данными
            </p>
          </div>
          <button
            onClick={() => router.push("/integrations/new")}
            className="h-10 px-5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium flex items-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Новая интеграция
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по имени или URL..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
          />
        </div>

        {isLoading && !loaded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-5 rounded-2xl border border-border bg-surface">
                <div className="flex items-start gap-3 mb-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-1.5" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        )}

        {loaded && (
          <>
            {filtered.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((intg) => (
                  <IntegrationCard
                    key={intg.id}
                    integration={intg}
                    onDelete={(id) => setDeleteId(id)}
                    onDiscover={handleDiscover}
                    onReconnect={handleReconnect}
                    onClick={(id) => router.push(`/integrations/${id}/edit`)}
                  />
                ))}
              </div>
            )}

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

            {normalizedQuery && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="h-12 w-12 rounded-xl bg-surface flex items-center justify-center mb-4 border border-border">
                  <Search className="h-6 w-6 text-text-secondary" />
                </div>
                <p className="text-sm font-medium text-text-primary mb-1">Ничего не найдено</p>
                <p className="text-sm text-text-secondary">Попробуйте изменить поисковый запрос</p>
              </div>
            )}

            {items.length === 0 && !normalizedQuery && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20"
              >
                <div className="h-16 w-16 rounded-2xl bg-surface-alt flex items-center justify-center mx-auto mb-5">
                  <Database className="h-8 w-8 text-text-secondary" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary mb-2">Нет интеграций</h2>
                <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
                  Подключите 1С, WhatsApp или другую систему для обмена данными через AI-агента
                </p>
                <button
                  onClick={() => router.push("/integrations/new")}
                  className="h-10 px-5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium inline-flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Создать интеграцию
                </button>
              </motion.div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
        title="Удалить интеграцию?"
        description="Интеграция будет отключена от всех агентов и удалена."
        confirmText="Удалить"
      />
    </div>
  );
}
