"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SkillForm } from "@/components/skills/SkillForm";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Skill } from "@/types/skill";

export default function AdminEditSkillPage() {
  const params = useParams();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/skills/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSkill(data);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-5">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-text-secondary">Скилл не найден</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <SkillForm initial={skill} adminMode />
    </div>
  );
}
