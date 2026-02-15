"use client";

import { useState } from "react";
import { Puzzle, ToggleLeft, ToggleRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  enabled: boolean;
  icon: string;
}

const BUILT_IN_PLUGINS: Plugin[] = [
  {
    id: "web-search",
    name: "Веб-поиск",
    description: "Поиск актуальной информации в интернете через Tavily/Google",
    version: "1.0.0",
    author: "Sanbao",
    enabled: true,
    icon: "🔍",
  },
  {
    id: "document-parser",
    name: "Парсер документов",
    description: "Извлечение текста из PDF, DOCX, XLSX файлов",
    version: "1.0.0",
    author: "Sanbao",
    enabled: true,
    icon: "📄",
  },
  {
    id: "citation-formatter",
    name: "Форматирование ссылок",
    description: "Автоформатирование цитат по ГОСТ Р 7.0.5-2008",
    version: "1.0.0",
    author: "Sanbao",
    enabled: false,
    icon: "📑",
  },
  {
    id: "court-calendar",
    name: "Календарь заседаний",
    description: "Отслеживание судебных заседаний и дедлайнов",
    version: "0.9.0",
    author: "Sanbao",
    enabled: false,
    icon: "📅",
  },
];

export function PluginManager() {
  const [plugins, setPlugins] = useState<Plugin[]>(BUILT_IN_PLUGINS);

  const togglePlugin = (id: string) => {
    setPlugins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const enabledCount = plugins.filter((p) => p.enabled).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          Плагины расширяют возможности AI: парсинг документов, поиск,
          форматирование и другие функции.
        </p>
        <span className="text-xs text-text-muted shrink-0 ml-2">
          {enabledCount}/{plugins.length}
        </span>
      </div>

      {plugins.map((plugin) => (
        <div
          key={plugin.id}
          className={cn(
            "flex items-center justify-between p-3 rounded-xl border transition-colors",
            plugin.enabled
              ? "bg-surface-alt border-accent/20"
              : "bg-surface-alt border-border opacity-70"
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg shrink-0">{plugin.icon}</span>
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
                {plugin.description}
              </p>
            </div>
          </div>
          <button
            onClick={() => togglePlugin(plugin.id)}
            className="shrink-0 ml-3 cursor-pointer text-text-muted hover:text-accent transition-colors"
          >
            {plugin.enabled ? (
              <ToggleRight className="h-6 w-6 text-accent" />
            ) : (
              <ToggleLeft className="h-6 w-6" />
            )}
          </button>
        </div>
      ))}

      <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border text-xs text-text-muted hover:text-accent hover:border-accent/30 transition-colors cursor-pointer">
        <ExternalLink className="h-3.5 w-3.5" />
        Каталог плагинов (скоро)
      </button>
    </div>
  );
}
