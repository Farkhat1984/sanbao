"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ICON_MAP } from "./AgentIconPicker";
import { cn } from "@/lib/utils";

interface ToolItem {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  iconColor: string;
  type: string;
}

interface AgentToolPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function AgentToolPicker({ selectedIds, onChange }: AgentToolPickerProps) {
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tools")
      .then((r) => r.json())
      .then((data) => setTools(Array.isArray(data) ? data : []))
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
        Загрузка инструментов...
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <p className="text-xs text-text-muted py-2">
        Нет доступных инструментов. Создайте инструмент в админ-панели.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tools.map((tool) => {
        const Icon = ICON_MAP[tool.icon] || ICON_MAP.Wrench;
        const selected = selectedIds.includes(tool.id);
        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => toggle(tool.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border",
              selected
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface-alt text-text-muted hover:text-text-primary hover:border-border-hover"
            )}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: selected ? undefined : tool.iconColor }} />
            {tool.name}
          </button>
        );
      })}
    </div>
  );
}
