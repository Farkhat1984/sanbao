"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ICON_MAP } from "./AgentIconPicker";
import { cn } from "@/lib/utils";

interface SkillItem {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  jurisdiction: string | null;
}

interface AgentSkillPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function AgentSkillPicker({ selectedIds, onChange }: AgentSkillPickerProps) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data) => setSkills(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text-muted text-xs py-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Загрузка скиллов...
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <p className="text-xs text-text-muted py-2">
        Нет доступных скиллов. Создайте скилл в разделе «Скиллы».
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => {
        const Icon = ICON_MAP[skill.icon] || ICON_MAP.Scale;
        const selected = selectedIds.includes(skill.id);
        return (
          <button
            key={skill.id}
            type="button"
            onClick={() => toggle(skill.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border",
              selected
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface-alt text-text-muted hover:text-text-primary hover:border-border-hover"
            )}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: selected ? undefined : skill.iconColor }} />
            {skill.name}
            {skill.jurisdiction && (
              <span className="text-[10px] opacity-60">{skill.jurisdiction}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
