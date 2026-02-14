"use client";

import { useState } from "react";
import { Plus, Trash2, RefreshCw, Circle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface McpServer {
  id: string;
  name: string;
  url: string;
  status: "connected" | "disconnected" | "error";
  tools: string[];
}

const DEMO_SERVERS: McpServer[] = [];

export function McpServerManager() {
  const [servers, setServers] = useState<McpServer[]>(DEMO_SERVERS);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const handleAdd = () => {
    if (!name.trim() || !url.trim()) return;
    const server: McpServer = {
      id: crypto.randomUUID(),
      name: name.trim(),
      url: url.trim(),
      status: "disconnected",
      tools: [],
    };
    setServers((s) => [...s, server]);
    setName("");
    setUrl("");
    setShowForm(false);
  };

  const handleRemove = (id: string) => {
    setServers((s) => s.filter((srv) => srv.id !== id));
  };

  const statusColor = {
    connected: "text-green-500",
    disconnected: "text-text-muted",
    error: "text-error",
  };

  const statusLabel = {
    connected: "Подключён",
    disconnected: "Отключён",
    error: "Ошибка",
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        MCP-серверы предоставляют AI дополнительные инструменты: поиск по базе
        законов, работа с API, файловые операции и другие функции.
      </p>

      {servers.length === 0 && !showForm && (
        <div className="text-center py-6 text-text-muted text-xs">
          Нет подключённых MCP-серверов
        </div>
      )}

      {servers.map((srv) => (
        <div
          key={srv.id}
          className="flex items-center justify-between p-3 rounded-xl bg-surface-alt border border-border"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Circle
              className={cn("h-2.5 w-2.5 fill-current shrink-0", statusColor[srv.status])}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {srv.name}
              </p>
              <p className="text-xs text-text-muted truncate">{srv.url}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={cn("text-xs", statusColor[srv.status])}>
              {statusLabel[srv.status]}
            </span>
            <button className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-text-primary cursor-pointer transition-colors">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleRemove(srv.id)}
              className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950 text-text-muted hover:text-error cursor-pointer transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="space-y-2 p-3 rounded-xl border border-accent/20 bg-accent-light/30">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название (напр. Legal Search)"
            className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL (напр. http://localhost:3100/mcp)"
            className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowForm(false); setName(""); setUrl(""); }}
            >
              Отмена
            </Button>
            <Button size="sm" onClick={handleAdd}>
              Добавить
            </Button>
          </div>
        </div>
      )}

      {!showForm && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowForm(true)}
          className="w-full"
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить MCP-сервер
        </Button>
      )}
    </div>
  );
}
