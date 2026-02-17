"use client";

import { Pencil, Copy, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";
import type { Skill } from "@/types/skill";

interface SkillCardProps {
  skill: Skill;
  isOwner?: boolean;
  onClone?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function SkillCard({ skill, isOwner, onClone, onDelete }: SkillCardProps) {
  const router = useRouter();
  const Icon = ICON_MAP[skill.icon] || ICON_MAP.Scale;

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
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">
            {skill.name}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {skill.jurisdiction || "Без юрисдикции"}
            {skill.isBuiltIn && " \u00B7 Встроенный"}
          </p>
        </div>
      </div>

      {skill.description && (
        <p className="text-xs text-text-muted leading-relaxed line-clamp-2 mb-4">
          {skill.description}
        </p>
      )}

      <div className="flex items-center gap-2 pt-3 border-t border-border">
        {isOwner && !skill.isBuiltIn && (
          <>
            <button
              onClick={() => router.push(`/skills/${skill.id}/edit`)}
              className="h-7 px-3 rounded-lg bg-surface-alt text-text-muted text-xs font-medium hover:text-text-primary transition-colors cursor-pointer flex items-center gap-1"
            >
              <Pencil className="h-3 w-3" />
              Изменить
            </button>
            <button
              onClick={() => onDelete?.(skill.id)}
              className="h-7 px-3 rounded-lg text-text-muted text-xs hover:text-error hover:bg-red-50 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        )}
        {!isOwner && onClone && (
          <button
            onClick={() => onClone(skill.id)}
            className="h-7 px-3 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors cursor-pointer flex items-center gap-1"
          >
            <Copy className="h-3 w-3" />
            Клонировать
          </button>
        )}
      </div>
    </motion.div>
  );
}
