"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Circle, Wrench, Globe, User, ChevronDown, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface McpServerItem {
  id: string;
  name: string;
  url: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  discoveredTools: Array<{ name: string; description?: string }> | null;
  isGlobal?: boolean;
}

/** Configuration for a single MCP server attached to an agent */
export interface McpServerConfig {
  id: string;
  allowedTools?: string[];
  domainMappings?: {
    defaultDomain?: string;
    toolDomains?: Record<string, string>;
  };
}

interface AgentMcpPickerProps {
  /** New rich format: array of server configs */
  selectedServers?: McpServerConfig[];
  /** Legacy format: array of server IDs (backward compat) */
  selectedIds?: string[];
  /** New rich callback */
  onChangeServers?: (servers: McpServerConfig[]) => void;
  /** Legacy callback */
  onChange?: (ids: string[]) => void;
}

export function AgentMcpPicker({
  selectedServers,
  selectedIds,
  onChangeServers,
  onChange,
}: AgentMcpPickerProps) {
  const [servers, setServers] = useState<McpServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Normalize: support both legacy selectedIds and new selectedServers
  const configs: McpServerConfig[] = selectedServers
    ?? (selectedIds ?? []).map((id) => ({ id }));

  const isSelected = useCallback(
    (id: string) => configs.some((c) => c.id === id),
    [configs],
  );

  const getConfig = useCallback(
    (id: string): McpServerConfig | undefined => configs.find((c) => c.id === id),
    [configs],
  );

  const emitChange = useCallback(
    (next: McpServerConfig[]) => {
      if (onChangeServers) {
        onChangeServers(next);
      }
      if (onChange) {
        onChange(next.map((c) => c.id));
      }
    },
    [onChangeServers, onChange],
  );

  useEffect(() => {
    fetch("/api/mcp")
      .then((r) => r.json())
      .then((data) => setServers(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    if (isSelected(id)) {
      emitChange(configs.filter((c) => c.id !== id));
      if (expandedId === id) setExpandedId(null);
    } else {
      emitChange([...configs, { id }]);
    }
  };

  const updateConfig = (id: string, patch: Partial<McpServerConfig>) => {
    emitChange(
      configs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  };

  const toggleAllowedTool = (serverId: string, toolName: string) => {
    const cfg = getConfig(serverId);
    if (!cfg) return;
    const current = cfg.allowedTools ?? [];
    const next = current.includes(toolName)
      ? current.filter((t) => t !== toolName)
      : [...current, toolName];
    updateConfig(serverId, { allowedTools: next.length > 0 ? next : undefined });
  };

  const statusColor: Record<string, string> = {
    CONNECTED: "text-success",
    DISCONNECTED: "text-text-secondary",
    ERROR: "text-error",
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text-secondary text-xs py-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Загрузка MCP-серверов...
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <p className="text-xs text-text-secondary py-2">
        Нет MCP-серверов. Добавьте сервер в разделе «Настройки &rarr; MCP».
      </p>
    );
  }

  const systemServers = servers.filter((s) => s.isGlobal);
  const userServers = servers.filter((s) => !s.isGlobal);

  const renderConfigPanel = (srv: McpServerItem) => {
    const cfg = getConfig(srv.id);
    if (!cfg) return null;
    const tools: Array<{ name: string; description?: string }> = Array.isArray(srv.discoveredTools) ? srv.discoveredTools : [];
    const allowedTools = cfg.allowedTools ?? [];
    const defaultDomain = cfg.domainMappings?.defaultDomain ?? "";

    return (
      <div className="mt-2 ml-5 mr-1 p-3 rounded-xl bg-surface-alt/50 border border-border/50 space-y-3">
        {/* Default Domain */}
        <div>
          <label className="text-[11px] font-medium text-text-secondary mb-1 block">
            Домен по умолчанию
          </label>
          <input
            type="text"
            value={defaultDomain}
            onChange={(e) => {
              const val = e.target.value.trim();
              const dm = cfg.domainMappings ?? {};
              const next = val
                ? { ...dm, defaultDomain: val }
                : { ...dm, defaultDomain: undefined };
              // Clean up if empty
              if (!next.defaultDomain && (!next.toolDomains || Object.keys(next.toolDomains).length === 0)) {
                updateConfig(srv.id, { domainMappings: undefined });
              } else {
                updateConfig(srv.id, { domainMappings: next });
              }
            }}
            placeholder="например: legal_kz"
            className="w-full h-8 px-3 rounded-lg bg-surface border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors font-mono"
          />
          <p className="text-[10px] text-text-muted mt-0.5">
            Коллекция данных для поиска
          </p>
        </div>

        {/* Allowed Tools */}
        {tools.length > 0 && (
          <div>
            <label className="text-[11px] font-medium text-text-secondary mb-1.5 block">
              Разрешённые инструменты
            </label>
            <div className="space-y-1">
              {tools.map((tool) => {
                const checked = allowedTools.includes(tool.name);
                return (
                  <button
                    key={tool.name}
                    type="button"
                    onClick={() => toggleAllowedTool(srv.id, tool.name)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer",
                      checked
                        ? "bg-accent/10 border border-accent/30"
                        : "bg-surface border border-border/50 hover:border-border-hover",
                    )}
                  >
                    <div
                      className={cn(
                        "h-3.5 w-3.5 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors",
                        checked
                          ? "bg-accent border-accent"
                          : "border-border bg-surface-alt",
                      )}
                    >
                      {checked && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <span className="text-[11px] font-mono text-text-primary truncate">
                      {tool.name}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-text-muted mt-1">
              {allowedTools.length === 0
                ? "Все инструменты разрешены"
                : `Выбрано: ${allowedTools.length} из ${tools.length}`}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderServer = (srv: McpServerItem) => {
    const selected = isSelected(srv.id);
    const tools = Array.isArray(srv.discoveredTools) ? srv.discoveredTools : [];
    const expanded = expandedId === srv.id && selected;
    const hasRichMode = Boolean(onChangeServers);

    return (
      <div key={srv.id}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => toggle(srv.id)}
            className={cn(
              "flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer border",
              selected
                ? "border-accent bg-accent/5"
                : "border-border bg-surface-alt hover:border-border-hover",
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
              <p className="text-[11px] text-text-secondary truncate">{srv.url}</p>
            </div>
            {tools.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-text-secondary shrink-0">
                <Wrench className="h-3 w-3" />
                {tools.length}
              </span>
            )}
          </button>

          {/* Expand/collapse config - only in rich mode */}
          {selected && hasRichMode && (
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : srv.id)}
              className="h-9 w-9 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer shrink-0"
              title="Настройки"
            >
              {expanded
                ? <ChevronDown className="h-4 w-4" />
                : <ChevronRight className="h-4 w-4" />
              }
            </button>
          )}
        </div>

        {/* Config panel */}
        {expanded && hasRichMode && renderConfigPanel(srv)}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {systemServers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-text-secondary uppercase tracking-wider">
            <Globe className="h-3 w-3" />
            Системные
          </div>
          {systemServers.map(renderServer)}
        </div>
      )}
      {userServers.length > 0 && (
        <div className="space-y-2">
          {systemServers.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-text-secondary uppercase tracking-wider">
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
