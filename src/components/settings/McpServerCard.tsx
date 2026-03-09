"use client";

import { Trash2, RefreshCw, Circle, ChevronDown, ChevronUp, Loader2, Wrench, Power, PowerOff, Globe, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { McpToolList } from "./McpToolList";

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
  isGlobal?: boolean;
  userActive?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  CONNECTED: "text-success",
  DISCONNECTED: "text-text-secondary",
  ERROR: "text-error",
};

const STATUS_LABEL: Record<string, string> = {
  CONNECTED: "Подключён",
  DISCONNECTED: "Отключён",
  ERROR: "Ошибка",
};

interface McpServerCardProps {
  server: McpServer;
  variant: "system" | "user";
  isExpanded: boolean;
  onToggleExpand: () => void;
  /** System variant: toggling global active state */
  isToggling?: boolean;
  onToggleGlobal?: (id: string, currentActive: boolean) => void;
  /** User variant: connect/disconnect/remove */
  isConnecting?: boolean;
  isDisconnecting?: boolean;
  onConnect?: (id: string) => void;
  onDisconnect?: (id: string) => void;
  onRemove?: (id: string) => void;
}

/** Shared card component for both system and user MCP servers */
export function McpServerCard({
  server,
  variant,
  isExpanded,
  onToggleExpand,
  isToggling,
  onToggleGlobal,
  isConnecting,
  isDisconnecting,
  onConnect,
  onDisconnect,
  onRemove,
}: McpServerCardProps) {
  const tools = Array.isArray(server.discoveredTools) ? server.discoveredTools : [];

  if (variant === "system") {
    return <SystemCard server={server} tools={tools} isExpanded={isExpanded} onToggleExpand={onToggleExpand} isToggling={isToggling} onToggleGlobal={onToggleGlobal} />;
  }

  return <UserCard server={server} tools={tools} isExpanded={isExpanded} onToggleExpand={onToggleExpand} isConnecting={isConnecting} isDisconnecting={isDisconnecting} onConnect={onConnect} onDisconnect={onDisconnect} onRemove={onRemove} />;
}

// ── System server card ──────────────────────────────────────

interface SystemCardInternalProps {
  server: McpServer;
  tools: McpToolInfo[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  isToggling?: boolean;
  onToggleGlobal?: (id: string, currentActive: boolean) => void;
}

function SystemCard({ server, tools, isExpanded, onToggleExpand, isToggling, onToggleGlobal }: SystemCardInternalProps) {
  const isActive = server.userActive ?? false;

  return (
    <div className={cn("rounded-xl bg-surface-alt border border-border overflow-hidden transition-opacity", !isActive && "opacity-50")}>
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3 min-w-0">
          <Globe className="h-3.5 w-3.5 text-accent shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{server.name}</p>
            <p className="text-xs text-text-secondary truncate">
              {tools.length > 0 ? `${tools.length} инструментов` : server.transport === "STREAMABLE_HTTP" ? "HTTP" : "SSE"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isActive && tools.length > 0 && (
            <button
              onClick={onToggleExpand}
              className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary cursor-pointer px-1.5 py-1 rounded-md hover:bg-surface-hover transition-colors"
            >
              <Wrench className="h-3 w-3" />
              {tools.length}
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
          <button
            onClick={() => onToggleGlobal?.(server.id, isActive)}
            disabled={!!isToggling}
            title={isActive ? "Отключить" : "Подключить"}
            className={cn(
              "h-9 w-9 sm:h-auto sm:w-auto sm:px-2 sm:py-1.5 flex items-center justify-center gap-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50",
              isActive
                ? "text-success hover:text-warning hover:bg-warning-light"
                : "text-text-secondary hover:text-success hover:bg-success-light"
            )}
          >
            {isToggling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isActive ? (
              <ToggleRight className="h-4 w-4" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
            <span className="hidden sm:inline text-xs">{isActive ? "Вкл" : "Выкл"}</span>
          </button>
        </div>
      </div>

      {isActive && isExpanded && tools.length > 0 && (
        <McpToolList tools={tools} />
      )}
    </div>
  );
}

// ── User server card ────────────────────────────────────────

interface UserCardInternalProps {
  server: McpServer;
  tools: McpToolInfo[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
  onConnect?: (id: string) => void;
  onDisconnect?: (id: string) => void;
  onRemove?: (id: string) => void;
}

function UserCard({ server, tools, isExpanded, onToggleExpand, isConnecting, isDisconnecting, onConnect, onDisconnect, onRemove }: UserCardInternalProps) {
  const isConnected = server.status === "CONNECTED";

  return (
    <div className="rounded-xl bg-surface-alt border border-border overflow-hidden">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3 min-w-0">
          <Circle
            className={cn("h-2.5 w-2.5 fill-current shrink-0", STATUS_COLOR[server.status])}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{server.name}</p>
            <p className="text-xs text-text-secondary truncate">
              {server.url}
              <span className="ml-2 opacity-60">{server.transport === "STREAMABLE_HTTP" ? "HTTP" : "SSE"}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {tools.length > 0 && (
            <button
              onClick={onToggleExpand}
              className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary cursor-pointer px-1.5 py-1 rounded-md hover:bg-surface-hover transition-colors"
            >
              <Wrench className="h-3 w-3" />
              {tools.length}
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
          <span className={cn("text-xs", STATUS_COLOR[server.status])}>
            {STATUS_LABEL[server.status]}
          </span>
          {isConnected ? (
            <button
              onClick={() => onDisconnect?.(server.id)}
              disabled={!!isDisconnecting}
              title="Отключить"
              className="h-9 w-9 sm:h-auto sm:w-auto sm:p-1.5 flex items-center justify-center rounded-md hover:bg-warning-light text-text-secondary hover:text-warning cursor-pointer transition-colors disabled:opacity-50"
            >
              {isDisconnecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PowerOff className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <button
              onClick={() => onConnect?.(server.id)}
              disabled={!!isConnecting}
              title="Подключить"
              className="h-9 w-9 sm:h-auto sm:w-auto sm:p-1.5 flex items-center justify-center rounded-md hover:bg-success-light text-text-secondary hover:text-success cursor-pointer transition-colors disabled:opacity-50"
            >
              {isConnecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Power className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <button
            onClick={() => onConnect?.(server.id)}
            disabled={!!isConnecting}
            title="Переподключить"
            className="h-9 w-9 sm:h-auto sm:w-auto sm:p-1.5 flex items-center justify-center rounded-md hover:bg-surface-hover text-text-secondary hover:text-text-primary cursor-pointer transition-colors disabled:opacity-50"
          >
            {isConnecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => onRemove?.(server.id)}
            title="Удалить"
            className="h-9 w-9 sm:h-auto sm:w-auto sm:p-1.5 flex items-center justify-center rounded-md hover:bg-error-light text-text-secondary hover:text-error cursor-pointer transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {isExpanded && tools.length > 0 && (
        <McpToolList tools={tools} />
      )}
    </div>
  );
}
