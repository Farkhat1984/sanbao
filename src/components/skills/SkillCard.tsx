"use client";

import { PencilSimple, Copy, Trash, Users } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";
import { SKILL_CATEGORIES } from "@/lib/constants";
import type { Skill } from "@/types/skill";

interface SkillCardProps {
  skill: Skill;
  isOwner?: boolean;
  onClone?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const CATEGORY_MAP: Record<string, { label: string; color: string }> = Object.fromEntries(
  SKILL_CATEGORIES.map((c) => [
    c.value,
    {
      label: c.label,
      color:
        c.value === "LEGAL" ? "bg-accent-light text-accent" :
        c.value === "BUSINESS" ? "bg-warning-light text-warning" :
        c.value === "CODE" ? "bg-success-light text-success" :
        c.value === "CONTENT" ? "bg-[#EDE9FE] text-[#7C3AED]" :
        c.value === "ANALYSIS" ? "bg-[#E0F2FE] text-[#0284C7]" :
        c.value === "PRODUCTIVITY" ? "bg-[#FEF3C7] text-[#D97706]" :
        "bg-surface-alt text-text-secondary",
    },
  ]),
);

const MAX_VISIBLE_TAGS = 3;

export function SkillCard({ skill, isOwner, onClone, onDelete }: SkillCardProps) {
  const router = useRouter();
  const Icon = ICON_MAP[skill.icon] || ICON_MAP.Scale;
  const categoryInfo = CATEGORY_MAP[skill.category];
  const visibleTags = skill.tags?.slice(0, MAX_VISIBLE_TAGS) ?? [];
  const overflowCount = (skill.tags?.length ?? 0) - MAX_VISIBLE_TAGS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="group p-5 rounded-2xl border border-border bg-surface hover:border-border-hover transition-all duration-200"
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: skill.iconColor }}
        >
          <Icon weight="duotone" className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">
            {skill.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {categoryInfo && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${categoryInfo.color}`}>
                {categoryInfo.label}
              </span>
            )}
            {skill.usageCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted">
                <Users weight="duotone" className="h-2.5 w-2.5" />
                {skill.usageCount} {skill.usageCount === 1 ? "агент" : "агентов"}
              </span>
            )}
            {skill.isBuiltIn && (
              <span className="text-[10px] text-text-muted">Встроенный</span>
            )}
          </div>
        </div>
      </div>

      {skill.description && (
        <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-3">
          {skill.description}
        </p>
      )}

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-alt text-text-muted border border-border"
            >
              {tag}
            </span>
          ))}
          {overflowCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-text-muted">
              +{overflowCount}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-3 border-t border-border">
        {isOwner && !skill.isBuiltIn && (
          <>
            <button
              onClick={() => router.push(`/skills/${skill.id}/edit`)}
              className="h-7 px-3 rounded-lg bg-surface-alt text-text-secondary text-xs font-medium hover:text-text-primary transition-colors cursor-pointer flex items-center gap-1"
            >
              <PencilSimple weight="duotone" className="h-3 w-3" />
              Изменить
            </button>
            <button
              onClick={() => onDelete?.(skill.id)}
              className="h-7 px-3 rounded-lg text-text-secondary text-xs hover:text-error hover:bg-error-light transition-colors cursor-pointer flex items-center gap-1"
            >
              <Trash weight="duotone" className="h-3 w-3" />
            </button>
          </>
        )}
        {!isOwner && onClone && (
          <button
            onClick={() => onClone(skill.id)}
            className="h-7 px-3 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors cursor-pointer flex items-center gap-1"
          >
            <Copy weight="duotone" className="h-3 w-3" />
            Клонировать
          </button>
        )}
      </div>
    </motion.div>
  );
}
