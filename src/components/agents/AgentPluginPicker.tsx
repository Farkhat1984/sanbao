"use client";

import { useState, useEffect } from "react";
import { Loader2, Puzzle } from "lucide-react";
import { ICON_MAP } from "./AgentIconPicker";
import { cn } from "@/lib/utils";

interface PluginItem {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  iconColor: string;
  version: string;
}

interface AgentPluginPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function AgentPluginPicker({ selectedIds, onChange }: AgentPluginPickerProps) {
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/plugins")
      .then((r) => r.json())
      .then((data) => setPlugins(Array.isArray(data) ? data : []))
      .catch(console.error)
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
        Загрузка плагинов...
      </div>
    );
  }

  if (plugins.length === 0) {
    return (
      <p className="text-xs text-text-muted py-2">
        Нет доступных плагинов.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {plugins.map((plugin) => {
        const Icon = ICON_MAP[plugin.icon] || Puzzle;
        const selected = selectedIds.includes(plugin.id);
        return (
          <button
            key={plugin.id}
            type="button"
            onClick={() => toggle(plugin.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border",
              selected
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface-alt text-text-muted hover:text-text-primary hover:border-border-hover"
            )}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: selected ? undefined : plugin.iconColor }} />
            {plugin.name}
            <span className="text-[10px] opacity-60">v{plugin.version}</span>
          </button>
        );
      })}
    </div>
  );
}
