"use client";

import { useState, useEffect, useMemo } from "react";
import { SpinnerGap, Plus, Warning } from "@phosphor-icons/react";
import { ICON_MAP } from "./AgentIconPicker";
import { cn } from "@/lib/utils";
import { SKILL_CATEGORIES } from "@/lib/constants";
import { InlineSkillCreateModal } from "@/components/skills/InlineSkillCreateModal";

interface SkillItem {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  jurisdiction: string | null;
  category: string;
  systemPrompt?: string;
}

interface AgentSkillPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/** Rough token estimate: ~4 chars per token */
function estimateTokens(text: string | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

const TOKEN_WARNING_THRESHOLD = 2000;

const CATEGORY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  SKILL_CATEGORIES.map((c) => [c.value, c.label]),
);

export function AgentSkillPicker({ selectedIds, onChange }: AgentSkillPickerProps) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetch("/api/skills?include=systemPrompt")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.items ?? [];
        setSkills(list);
      })
      .catch(() => {
        // Fallback: try without include param
        fetch("/api/skills")
          .then((r) => r.json())
          .then((data) => setSkills(Array.isArray(data) ? data : data.items ?? []))
          .catch(() => setSkills([]));
      })
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id],
    );
  };

  /** Group skills by category for display */
  const groupedSkills = useMemo(() => {
    const groups: Record<string, SkillItem[]> = {};
    for (const skill of skills) {
      const cat = skill.category || "CUSTOM";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(skill);
    }
    // Sort categories by SKILL_CATEGORIES order
    const ordered: { category: string; label: string; items: SkillItem[] }[] = [];
    for (const cat of SKILL_CATEGORIES) {
      if (groups[cat.value]) {
        ordered.push({ category: cat.value, label: cat.label, items: groups[cat.value] });
        delete groups[cat.value];
      }
    }
    // Remaining categories not in SKILL_CATEGORIES
    for (const [cat, items] of Object.entries(groups)) {
      ordered.push({ category: cat, label: CATEGORY_LABEL_MAP[cat] || cat, items });
    }
    return ordered;
  }, [skills]);

  /** Total estimated tokens for selected skills */
  const totalSelectedTokens = useMemo(() => {
    return skills
      .filter((s) => selectedIds.includes(s.id))
      .reduce((sum, s) => sum + estimateTokens(s.systemPrompt), 0);
  }, [skills, selectedIds]);

  function handleSkillCreated(skill: {
    id: string;
    name: string;
    icon: string;
    iconColor: string;
    category: string;
  }) {
    const newSkill: SkillItem = {
      id: skill.id,
      name: skill.name,
      icon: skill.icon,
      iconColor: skill.iconColor,
      category: skill.category,
      jurisdiction: null,
    };
    setSkills((prev) => [newSkill, ...prev]);
    onChange([...selectedIds, skill.id]);
    setShowCreateModal(false);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text-secondary text-xs py-3">
        <SpinnerGap weight="bold" className="h-3.5 w-3.5 animate-spin" />
        Загрузка скиллов...
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-text-secondary py-2">
          Нет доступных скиллов.
        </p>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-border text-text-secondary hover:text-accent hover:border-accent transition-all cursor-pointer"
        >
          <Plus weight="duotone" className="h-3.5 w-3.5" />
          Создать скилл
        </button>
        <InlineSkillCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleSkillCreated}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Token warning banner */}
      {totalSelectedTokens > TOKEN_WARNING_THRESHOLD && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-warning-light border border-warning/20 text-warning text-xs font-medium">
          <Warning weight="duotone" className="h-3.5 w-3.5 shrink-0" />
          Выбранные скиллы используют ~{totalSelectedTokens} токенов контекста. Это может снизить качество ответов.
        </div>
      )}

      {groupedSkills.map((group) => (
        <div key={group.category}>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.items.map((skill) => {
              const Icon = ICON_MAP[skill.icon] || ICON_MAP.Scale;
              const selected = selectedIds.includes(skill.id);
              const tokens = estimateTokens(skill.systemPrompt);
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => toggle(skill.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border",
                    selected
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-surface-alt text-text-secondary hover:text-text-primary hover:border-border-hover",
                  )}
                >
                  <Icon
                    weight="duotone"
                    className="h-3.5 w-3.5"
                    style={{ color: selected ? undefined : skill.iconColor }}
                  />
                  {skill.name}
                  {skill.jurisdiction && (
                    <span className="text-[10px] opacity-60">{skill.jurisdiction}</span>
                  )}
                  {selected && tokens > 0 && (
                    <span className="text-[10px] opacity-70 tabular-nums">
                      ~{tokens}t
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Add skill button */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-border text-text-secondary hover:text-accent hover:border-accent transition-all cursor-pointer"
        >
          <Plus weight="duotone" className="h-3.5 w-3.5" />
          Создать скилл
        </button>
      </div>

      <InlineSkillCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleSkillCreated}
      />
    </div>
  );
}
