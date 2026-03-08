"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Zap, Sparkles, Search, TrendingUp, Clock,
  ChevronLeft, ChevronRight, Shield, Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SkillCard } from "@/components/skills/SkillCard";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { SKILL_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Skill } from "@/types/skill";

const SKILLS_PER_PAGE = 30;

export default function AdminSkillsPage() {
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "popular">("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [stats, setStats] = useState<{ totalSkills: number; activeSkills: number } | null>(null);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(SKILLS_PER_PAGE),
    });
    if (categoryFilter) params.set("category", categoryFilter);
    if (sortBy === "popular") params.set("sort", "popular");
    if (searchQuery.trim()) params.set("q", searchQuery.trim());

    const res = await fetch(`/api/admin/skills?${params}`);
    const data = await res.json();
    setSkills(data.skills || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page, categoryFilter, sortBy, searchQuery]);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);
  useEffect(() => { setPage(1); }, [categoryFilter, sortBy, searchQuery]);
  useEffect(() => {
    fetch("/api/admin/skills/stats").then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  async function handleDeleteConfirm() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await fetch(`/api/admin/skills/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSkills((prev) => prev.filter((s) => s.id !== id));
      setTotal((prev) => prev - 1);
    }
  }

  const builtIn = useMemo(() => skills.filter((s) => s.isBuiltIn), [skills]);
  const custom = useMemo(() => skills.filter((s) => !s.isBuiltIn), [skills]);
  const totalPages = Math.ceil(total / SKILLS_PER_PAGE);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">Скиллы</h1>
          <p className="text-sm text-text-secondary mt-1">
            Управление системными и пользовательскими скиллами
          </p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => router.push("/admin/skills/new")}>
          <Plus className="h-4 w-4" /> Создать скилл
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-surface border border-border rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-text-primary">{stats.totalSkills}</p>
            <p className="text-xs text-text-secondary">Всего</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-success">{stats.activeSkills}</p>
            <p className="text-xs text-text-secondary">Активных</p>
          </div>
        </div>
      )}

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
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по имени или описанию..."
          className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
        />
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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

      {/* Content */}
      {!loading && (
        <>
          {/* Built-in skills section */}
          {builtIn.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2.5 mb-4">
                <Shield className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Системные</h2>
                <span className="text-xs text-text-secondary tabular-nums">{builtIn.length}</span>
                <div className="flex-1 h-px bg-border ml-2" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {builtIn.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    adminMode
                    isOwner
                    onDelete={(id) => setDeleteId(id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Custom skills section */}
          {custom.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2.5 mb-4">
                <Users className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Пользовательские</h2>
                <span className="text-xs text-text-secondary tabular-nums">{custom.length}</span>
                <div className="flex-1 h-px bg-border ml-2" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {custom.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    adminMode
                    isOwner
                    onDelete={(id) => setDeleteId(id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {skills.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="h-12 w-12 rounded-xl bg-surface flex items-center justify-center mb-4 border border-border">
                {searchQuery.trim() ? (
                  <Search className="h-6 w-6 text-text-secondary" />
                ) : (
                  <Sparkles className="h-6 w-6 text-text-secondary" />
                )}
              </div>
              <p className="text-sm font-medium text-text-primary mb-1">
                {searchQuery.trim() ? "Ничего не найдено" : "Нет скиллов"}
              </p>
              <p className="text-sm text-text-secondary">
                {searchQuery.trim()
                  ? "Попробуйте изменить поисковый запрос"
                  : "Создайте первый скилл"}
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-xs text-text-secondary">{total} скиллов</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-alt disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-text-secondary">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-alt disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

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
