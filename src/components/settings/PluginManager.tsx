"use client";

import { useState, useEffect } from "react";
import { Puzzle, ToggleLeft, ToggleRight, ExternalLink, Loader2 } from "lucide-react";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";
import { cn } from "@/lib/utils";

interface Plugin {
  id: string;
  name: string;
  description: string | null;
  version: string;
  icon: string;
  iconColor: string;
  isActive: boolean;
}

export function PluginManager() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/plugins")
      .then((r) => r.json())
      .then((data) => setPlugins(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const togglePlugin = async (id: string) => {
    const plugin = plugins.find((p) => p.id === id);
    if (!plugin) return;

    const newActive = !plugin.isActive;
    setPlugins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: newActive } : p))
    );

    try {
      await fetch(`/api/plugins/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newActive }),
      });
    } catch {
      // Revert on error
      setPlugins((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isActive: !newActive } : p))
      );
    }
  };

  const enabledCount = plugins.filter((p) => p.isActive).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          Плагины расширяют возможности AI: парсинг документов, поиск,
          форматирование и другие функции.
        </p>
        {plugins.length > 0 && (
          <span className="text-xs text-text-muted shrink-0 ml-2">
            {enabledCount}/{plugins.length}
          </span>
        )}
      </div>

      {plugins.length === 0 && (
        <p className="text-xs text-text-muted text-center py-4">
          Нет доступных плагинов
        </p>
      )}

      {plugins.map((plugin) => {
        const Icon = ICON_MAP[plugin.icon] || Puzzle;
        return (
          <div
            key={plugin.id}
            className={cn(
              "flex items-center justify-between p-3 sm:p-4 rounded-xl border transition-colors",
              plugin.isActive
                ? "bg-surface-alt border-accent/20"
                : "bg-surface-alt border-border opacity-70"
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${plugin.iconColor}15` }}
              >
                <Icon className="h-4 w-4" style={{ color: plugin.iconColor }} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {plugin.name}
                  </p>
                  <span className="text-[10px] text-text-muted">
                    v{plugin.version}
                  </span>
                </div>
                <p className="text-xs text-text-muted truncate">
                  {plugin.description || "Без описания"}
                </p>
              </div>
            </div>
            <button
              onClick={() => togglePlugin(plugin.id)}
              className="shrink-0 ml-3 cursor-pointer text-text-muted hover:text-accent transition-colors"
            >
              {plugin.isActive ? (
                <ToggleRight className="h-6 w-6 text-accent" />
              ) : (
                <ToggleLeft className="h-6 w-6" />
              )}
            </button>
          </div>
        );
      })}

      <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border text-xs text-text-muted hover:text-accent hover:border-accent/30 transition-colors cursor-pointer">
        <ExternalLink className="h-3.5 w-3.5" />
        Каталог плагинов (скоро)
      </button>
    </div>
  );
}
