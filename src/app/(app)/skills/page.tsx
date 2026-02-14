"use client";

import { useEffect, useState } from "react";
import { Plus, Zap, Store } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSkillStore } from "@/stores/skillStore";
import { SkillCard } from "@/components/skills/SkillCard";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Skill } from "@/types/skill";

export default function SkillsPage() {
  const router = useRouter();
  const { setSkills, setLoading } = useSkillStore();
  const [skills, setLocalSkills] = useState<Skill[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetch("/api/skills")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setLocalSkills(data);
          setSkills(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
        setLoaded(true);
        setLoading(false);
      });
  }, [setSkills, setLoading]);

  const builtIn = skills.filter((s) => s.isBuiltIn);
  const custom = skills.filter((s) => !s.isBuiltIn);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/skills/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLocalSkills((prev) => prev.filter((s) => s.id !== id));
    }
  }

  return (
    <div className="h-full">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Скиллы</h1>
            <p className="text-sm text-text-muted mt-1">
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
              className="h-10 px-5 rounded-xl bg-gradient-to-r from-accent to-legal-ref text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Создать скилл
            </button>
          </div>
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
                <h2 className="text-sm font-semibold text-text-muted mb-4">
                  Встроенные скиллы
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {builtIn.map((skill) => (
                    <SkillCard key={skill.id} skill={skill} />
                  ))}
                </div>
              </div>
            )}

            {custom.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-text-muted mb-4">
                  Мои скиллы
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {custom.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      isOwner
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {skills.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20"
              >
                <div className="h-16 w-16 rounded-2xl bg-surface-alt flex items-center justify-center mx-auto mb-5">
                  <Zap className="h-8 w-8 text-text-muted" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary mb-2">
                  Нет скиллов
                </h2>
                <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
                  Создайте свой первый юридический скилл или загляните в маркетплейс
                </p>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
