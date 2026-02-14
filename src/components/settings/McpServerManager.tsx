"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, RefreshCw, Circle, ChevronDown, ChevronUp, Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface McpToolInfo {
  name: string;
  description: string;
}

interface McpServer {
  id: string;
  name: string;
  url: string;
  transport: "SSE" | "STREAMABLE_HTTP";
  apiKey: string | null;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  discoveredTools: McpToolInfo[] | null;
}

export function McpServerManager() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [transport, setTransport] = useState<"SSE" | "STREAMABLE_HTTP">("SSE");
  const [apiKey, setApiKey] = useState("");
  const [adding, setAdding] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp");
      if (res.ok) {
        const data = await res.json();
        setServers(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchServers(); }, [fetchServers]);

  const handleAdd = async () => {
    if (!name.trim() || !url.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          transport,
          apiKey: apiKey.trim() || null,
        }),
      });
      if (res.ok) {
        const server = await res.json();
        setServers((s) => [server, ...s]);
        setName(""); setUrl(""); setApiKey(""); setTransport("SSE");
        setShowForm(false);
      }
    } catch {
      // silent
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await fetch(`/api/mcp/${id}`, { method: "DELETE" });
      setServers((s) => s.filter((srv) => srv.id !== id));
    } catch {
      // silent
    }
  };

  const handleConnect = async (id: string) => {
    setConnectingId(id);
    try {
      const res = await fetch(`/api/mcp/${id}/connect`, { method: "POST" });
      const data = await res.json();
      setServers((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                status: data.status || (res.ok ? "CONNECTED" : "ERROR"),
                discoveredTools: data.tools || null,
              }
            : s
        )
      );
      if (res.ok) setExpandedId(id);
    } catch {
      setServers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "ERROR" } : s))
      );
    } finally {
      setConnectingId(null);
    }
  };

  const statusColor: Record<string, string> = {
    CONNECTED: "text-green-500",
    DISCONNECTED: "text-text-muted",
    ERROR: "text-error",
  };

  const statusLabel: Record<string, string> = {
    CONNECTED: "Подключён",
    DISCONNECTED: "Отключён",
    ERROR: "Ошибка",
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text-muted text-xs py-4">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Загрузка...
      </div>
    );
  }

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

      {servers.map((srv) => {
        const tools = Array.isArray(srv.discoveredTools) ? srv.discoveredTools : [];
        const isExpanded = expandedId === srv.id;

        return (
          <div key={srv.id} className="rounded-xl bg-surface-alt border border-border overflow-hidden">
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3 min-w-0">
                <Circle
                  className={cn("h-2.5 w-2.5 fill-current shrink-0", statusColor[srv.status])}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {srv.name}
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    {srv.url}
                    <span className="ml-2 opacity-60">{srv.transport === "STREAMABLE_HTTP" ? "HTTP" : "SSE"}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {tools.length > 0 && (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : srv.id)}
                    className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary cursor-pointer px-1.5 py-1 rounded-md hover:bg-surface-hover transition-colors"
                  >
                    <Wrench className="h-3 w-3" />
                    {tools.length}
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                )}
                <span className={cn("text-xs", statusColor[srv.status])}>
                  {statusLabel[srv.status]}
                </span>
                <button
                  onClick={() => handleConnect(srv.id)}
                  disabled={connectingId === srv.id}
                  className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-text-primary cursor-pointer transition-colors disabled:opacity-50"
                >
                  {connectingId === srv.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={() => handleRemove(srv.id)}
                  className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950 text-text-muted hover:text-error cursor-pointer transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {isExpanded && tools.length > 0 && (
              <div className="border-t border-border px-3 py-2 space-y-1">
                {tools.map((tool) => (
                  <div key={tool.name} className="flex items-start gap-2 py-1">
                    <Wrench className="h-3 w-3 text-text-muted mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-medium text-text-primary">{tool.name}</span>
                      {tool.description && (
                        <p className="text-[11px] text-text-muted">{tool.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

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
          <div className="flex gap-2">
            <select
              value={transport}
              onChange={(e) => setTransport(e.target.value as "SSE" | "STREAMABLE_HTTP")}
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="SSE">SSE</option>
              <option value="STREAMABLE_HTTP">Streamable HTTP</option>
            </select>
          </div>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API Key (опционально)"
            type="password"
            className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowForm(false); setName(""); setUrl(""); setApiKey(""); }}
            >
              Отмена
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={adding}>
              {adding ? "Добавление..." : "Добавить"}
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
