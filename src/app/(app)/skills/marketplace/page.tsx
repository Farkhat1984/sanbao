"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Storefront } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { SkillCard } from "@/components/skills/SkillCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { SKILL_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Skill } from "@/types/skill";

export default function MarketplacePage() {
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ marketplace: "true" });
    if (categoryFilter) params.set("category", categoryFilter);

    setLoading(true);
    fetch(`/api/skills?${params}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.items ?? [];
        setSkills(list);
      })
      .finally(() => setLoading(false));
  }, [categoryFilter]);

  async function handleClone(id: string) {
    const res = await fetch(`/api/skills/${id}/clone`, { method: "POST" });
    if (res.ok) {
      router.push("/skills");
    }
  }

  return (
    <div className="h-full">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.back()}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
          >
            <ArrowLeft weight="duotone" className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)] flex items-center gap-2">
              <Storefront weight="duotone" className="h-5 w-5" />
              Маркетплейс скиллов
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Клонируйте публичные скиллы в свою коллекцию
            </p>
          </div>
        </div>

        {/* Category filter tabs */}
        <div className="overflow-x-auto scrollbar-none mb-6">
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

        {loading ? (
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
        ) : skills.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onClone={handleClone}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Storefront weight="duotone" className="h-12 w-12 text-text-secondary mx-auto mb-4" />
            <p className="text-text-secondary">Пока нет публичных скиллов</p>
          </div>
        )}
      </div>
    </div>
  );
}
