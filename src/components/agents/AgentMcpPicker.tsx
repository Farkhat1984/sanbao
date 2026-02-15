"use client";

import { useState, useEffect } from "react";
import { Loader2, Circle, Wrench, Globe, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface McpServerItem {
  id: string;
  name: string;
  url: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  discoveredTools: Array<{ name: string }> | null;
  isGlobal?: boolean;
}

interface AgentMcpPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function AgentMcpPicker({ selectedIds, onChange }: AgentMcpPickerProps) {
  const [servers, setServers] = useState<McpServerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mcp")
      .then((r) => r.json())
      .then((data) => setServers(data))
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

  const statusColor: Record<string, string> = {
    CONNECTED: "text-green-500",
    DISCONNECTED: "text-text-muted",
    ERROR: "text-error",
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text-muted text-xs py-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Загрузка MCP-серверов...
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <p className="text-xs text-text-muted py-2">
        Нет MCP-серверов. Добавьте сервер в разделе «Настройки → MCP».
      </p>
    );
  }

  const systemServers = servers.filter((s) => s.isGlobal);
  const userServers = servers.filter((s) => !s.isGlobal);

  const renderServer = (srv: McpServerItem) => {
    const selected = selectedIds.includes(srv.id);
    const tools = Array.isArray(srv.discoveredTools) ? srv.discoveredTools : [];

    return (
      <button
        key={srv.id}
        type="button"
        onClick={() => toggle(srv.id)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer border",
          selected
            ? "border-accent bg-accent/5"
            : "border-border bg-surface-alt hover:border-border-hover"
        )}
      >
        <Circle
          className={cn("h-2 w-2 fill-current shrink-0", statusColor[srv.status])}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-text-primary truncate">{srv.name}</p>
            {srv.isGlobal && (
              <Globe className="h-3 w-3 text-accent shrink-0" />
            )}
          </div>
          <p className="text-[11px] text-text-muted truncate">{srv.url}</p>
        </div>
        {tools.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-text-muted shrink-0">
            <Wrench className="h-3 w-3" />
            {tools.length}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {systemServers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted uppercase tracking-wider">
            <Globe className="h-3 w-3" />
            Системные
          </div>
          {systemServers.map(renderServer)}
        </div>
      )}
      {userServers.length > 0 && (
        <div className="space-y-2">
          {systemServers.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-text-muted uppercase tracking-wider">
              <User className="h-3 w-3" />
              Пользовательские
            </div>
          )}
          {userServers.map(renderServer)}
        </div>
      )}
    </div>
  );
}
