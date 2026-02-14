"use client";

import { useState, useEffect } from "react";
import { Plus, Save, Trash2, Wifi, WifiOff, HeartPulse, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface McpServer {
  id: string;
  name: string;
  url: string;
  transport: string;
  status: string;
  discoveredTools: unknown;
  isGlobal: boolean;
  lastHealthCheck: string | null;
  createdAt: string;
}

interface ToolLog {
  id: string;
  toolName: string;
  durationMs: number | null;
  success: boolean;
  error: string | null;
  mcpServer: { name: string };
  createdAt: string;
}

export default function AdminMcpPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [checking, setChecking] = useState(false);
  const [tab, setTab] = useState<"servers" | "logs">("servers");
  const [toolLogs, setToolLogs] = useState<ToolLog[]>([]);
  const [newServer, setNewServer] = useState({ name: "", url: "", transport: "SSE", apiKey: "" });

  const fetchServers = async () => {
    const res = await fetch("/api/admin/mcp");
    setServers(await res.json());
    setLoading(false);
  };

  const fetchToolLogs = async () => {
    const res = await fetch("/api/admin/mcp/tool-logs");
    const data = await res.json();
    setToolLogs(data.logs || []);
  };

  useEffect(() => { fetchServers(); }, []);
  useEffect(() => { if (tab === "logs") fetchToolLogs(); }, [tab]);

  const handleHealthCheck = async () => {
    setChecking(true);
    await fetch("/api/admin/mcp/health-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    await fetchServers();
    setChecking(false);
  };

  const handleCreate = async () => {
    const res = await fetch("/api/admin/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newServer),
    });
    if (res.ok) {
      setAdding(false);
      setNewServer({ name: "", url: "", transport: "SSE", apiKey: "" });
      fetchServers();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить MCP-сервер?")) return;
    await fetch(`/api/admin/mcp/${id}`, { method: "DELETE" });
    fetchServers();
  };

  const statusColor = (s: string) => {
    if (s === "CONNECTED") return "bg-success";
    if (s === "ERROR") return "bg-error";
    return "bg-text-muted";
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Глобальные MCP-серверы</h1>
          <p className="text-sm text-text-muted mt-1">Серверы доступные всем пользователям</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleHealthCheck} isLoading={checking}>
            <HeartPulse className="h-4 w-4" /> Health Check
          </Button>
          <Button variant="gradient" size="sm" onClick={() => setAdding(!adding)}>
            <Plus className="h-4 w-4" /> Добавить
          </Button>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        <button onClick={() => setTab("servers")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tab === "servers" ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-alt"}`}>Серверы</button>
        <button onClick={() => setTab("logs")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tab === "logs" ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-alt"}`}><FileText className="h-3 w-3 inline mr-1" />Tool Logs</button>
      </div>

      {tab === "logs" && (
        <div className="space-y-2">
          {toolLogs.map((log) => (
            <div key={log.id} className="bg-surface border border-border rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${log.success ? "bg-success" : "bg-error"}`} />
                  <span className="text-sm font-mono font-medium text-text-primary">{log.toolName}</span>
                  <span className="text-xs text-text-muted">{log.mcpServer.name}</span>
                </div>
                {log.error && <p className="text-xs text-error mt-0.5">{log.error}</p>}
              </div>
              <div className="text-right">
                <span className="text-xs text-text-muted">{log.durationMs}ms</span>
                <p className="text-xs text-text-muted">{new Date(log.createdAt).toLocaleString("ru-RU")}</p>
              </div>
            </div>
          ))}
          {toolLogs.length === 0 && <p className="text-sm text-text-muted text-center py-8">Нет логов вызовов</p>}
        </div>
      )}

      {tab === "servers" && adding && (
        <div className="bg-surface border border-accent/30 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Новый MCP-сервер</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Название" value={newServer.name} onChange={(e) => setNewServer({ ...newServer, name: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <input placeholder="URL (http://...)" value={newServer.url} onChange={(e) => setNewServer({ ...newServer, url: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <select value={newServer.transport} onChange={(e) => setNewServer({ ...newServer, transport: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent">
              <option value="SSE">SSE</option>
              <option value="STREAMABLE_HTTP">Streamable HTTP</option>
            </select>
            <input placeholder="API Key (опционально)" type="password" value={newServer.apiKey} onChange={(e) => setNewServer({ ...newServer, apiKey: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
          </div>
          <div className="mt-3">
            <Button variant="gradient" size="sm" onClick={handleCreate}><Save className="h-3.5 w-3.5" /> Создать</Button>
          </div>
        </div>
      )}

      {tab === "servers" && <div className="space-y-3">
        {servers.map((s) => (
          <div key={s.id} className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {s.status === "CONNECTED" ? <Wifi className="h-4 w-4 text-success" /> : <WifiOff className="h-4 w-4 text-text-muted" />}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{s.name}</span>
                    <div className={`h-2 w-2 rounded-full ${statusColor(s.status)}`} />
                    <Badge variant="default">{s.transport}</Badge>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 font-mono">{s.url}
                    {s.lastHealthCheck && <span className="ml-2 font-sans">Last check: {new Date(s.lastHealthCheck).toLocaleString("ru-RU")}</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {Array.isArray(s.discoveredTools) && (
                  <span className="text-xs text-text-muted">{String((s.discoveredTools as unknown[]).length)} инструментов</span>
                )}
                <button onClick={() => handleDelete(s.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
        {servers.length === 0 && <p className="text-sm text-text-muted text-center py-8">Глобальные MCP-серверы не добавлены</p>}
      </div>}
    </div>
  );
}
