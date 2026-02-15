"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Save, Trash2, Wifi, WifiOff, HeartPulse, FileText, ExternalLink, Copy, Check, Bookmark, Pencil, X, ToggleLeft, ToggleRight, Search, ChevronLeft, ChevronRight } from "lucide-react";
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
  isEnabled: boolean;
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

interface McpPreset {
  name: string;
  description: string;
  category: string;
  categoryColor: string;
  defaultUrl: string;
  transport: "SSE" | "STREAMABLE_HTTP";
  setupCommand: string;
  githubUrl: string;
  envVars: string[];
}

const MCP_PRESETS: McpPreset[] = [
  {
    name: "GitHub",
    description: "Управление репозиториями, PR, issues, branches. Code review и CI/CD автоматизация.",
    category: "Разработка",
    categoryColor: "#4F6EF7",
    defaultUrl: "http://localhost:3101/mcp",
    transport: "STREAMABLE_HTTP",
    setupCommand: "npx -y @modelcontextprotocol/server-github",
    githubUrl: "https://github.com/github/github-mcp-server",
    envVars: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
  },
  {
    name: "PostgreSQL",
    description: "SQL запросы, анализ данных, управление схемой. Прямой доступ к PostgreSQL базам.",
    category: "Базы данных",
    categoryColor: "#10B981",
    defaultUrl: "http://localhost:3102/mcp",
    transport: "STREAMABLE_HTTP",
    setupCommand: "npx -y @modelcontextprotocol/server-postgres postgresql://user:pass@localhost/db",
    githubUrl: "https://github.com/crystaldba/postgres-mcp",
    envVars: ["DATABASE_URL"],
  },
  {
    name: "Brave Search",
    description: "Приватный веб-поиск без трекинга. Поиск новостей, изображений, видео с фильтрацией.",
    category: "Поиск",
    categoryColor: "#F59E0B",
    defaultUrl: "http://localhost:3103/mcp",
    transport: "STREAMABLE_HTTP",
    setupCommand: "npx -y @modelcontextprotocol/server-brave-search",
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    envVars: ["BRAVE_API_KEY"],
  },
  {
    name: "Filesystem",
    description: "Чтение, запись, поиск файлов и директорий. Безопасный доступ к файловой системе.",
    category: "Файлы",
    categoryColor: "#7C3AED",
    defaultUrl: "http://localhost:3104/mcp",
    transport: "STREAMABLE_HTTP",
    setupCommand: "npx -y @modelcontextprotocol/server-filesystem /path/to/dir",
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    envVars: [],
  },
  {
    name: "Playwright",
    description: "Браузерная автоматизация и E2E тестирование. Скриншоты, навигация, взаимодействие.",
    category: "Тестирование",
    categoryColor: "#EF4444",
    defaultUrl: "http://localhost:3105/mcp",
    transport: "STREAMABLE_HTTP",
    setupCommand: "npx -y @playwright/mcp@latest",
    githubUrl: "https://github.com/microsoft/playwright-mcp",
    envVars: [],
  },
];

const SERVERS_PER_PAGE = 10;
const LOGS_PER_PAGE = 20;

export default function AdminMcpPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [checking, setChecking] = useState(false);
  const [tab, setTab] = useState<"servers" | "logs" | "catalog">("servers");
  const [toolLogs, setToolLogs] = useState<ToolLog[]>([]);
  const [newServer, setNewServer] = useState({ name: "", url: "", transport: "STREAMABLE_HTTP", apiKey: "" });
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: "", url: "", transport: "STREAMABLE_HTTP", apiKey: "" });
  const [saving, setSaving] = useState(false);

  // Search & filter
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTransport, setFilterTransport] = useState<string>("all");

  // Pagination
  const [serverPage, setServerPage] = useState(1);
  const [logPage, setLogPage] = useState(1);

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

  // Reset page on filter change
  useEffect(() => { setServerPage(1); }, [search, filterStatus, filterTransport]);
  useEffect(() => { setLogPage(1); }, [tab]);

  // Filtered servers
  const filteredServers = useMemo(() => {
    return servers.filter((s) => {
      const q = search.toLowerCase();
      if (q && !s.name.toLowerCase().includes(q) && !s.url.toLowerCase().includes(q)) return false;
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      if (filterTransport !== "all" && s.transport !== filterTransport) return false;
      return true;
    });
  }, [servers, search, filterStatus, filterTransport]);

  const totalServerPages = Math.max(1, Math.ceil(filteredServers.length / SERVERS_PER_PAGE));
  const pagedServers = filteredServers.slice((serverPage - 1) * SERVERS_PER_PAGE, serverPage * SERVERS_PER_PAGE);

  // Filtered logs (search by tool name or server name)
  const filteredLogs = useMemo(() => {
    if (!search) return toolLogs;
    const q = search.toLowerCase();
    return toolLogs.filter((l) => l.toolName.toLowerCase().includes(q) || l.mcpServer.name.toLowerCase().includes(q));
  }, [toolLogs, search]);

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE));
  const pagedLogs = filteredLogs.slice((logPage - 1) * LOGS_PER_PAGE, logPage * LOGS_PER_PAGE);

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
      setNewServer({ name: "", url: "", transport: "STREAMABLE_HTTP", apiKey: "" });
      fetchServers();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить MCP-сервер?")) return;
    await fetch(`/api/admin/mcp/${id}`, { method: "DELETE" });
    fetchServers();
  };

  const handleStartEdit = (s: McpServer) => {
    setEditingId(s.id);
    setEditData({ name: s.name, url: s.url, transport: s.transport, apiKey: "" });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({ name: "", url: "", transport: "STREAMABLE_HTTP", apiKey: "" });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const payload: Record<string, string> = {};
    if (editData.name) payload.name = editData.name;
    if (editData.url) payload.url = editData.url;
    if (editData.transport) payload.transport = editData.transport;
    if (editData.apiKey) payload.apiKey = editData.apiKey;
    const res = await fetch(`/api/admin/mcp/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setEditingId(null);
      setEditData({ name: "", url: "", transport: "STREAMABLE_HTTP", apiKey: "" });
      fetchServers();
    }
    setSaving(false);
  };

  const handleToggleEnabled = async (id: string, currentEnabled: boolean) => {
    const res = await fetch(`/api/admin/mcp/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: !currentEnabled }),
    });
    if (res.ok) {
      setServers((prev) => prev.map((s) => s.id === id ? { ...s, isEnabled: !currentEnabled } : s));
    }
  };

  const handleAddPreset = (preset: McpPreset) => {
    setNewServer({
      name: preset.name,
      url: preset.defaultUrl,
      transport: preset.transport,
      apiKey: "",
    });
    setAdding(true);
    setTab("servers");
  };

  const handleCopyCommand = (command: string, idx: number) => {
    navigator.clipboard.writeText(command);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const statusColor = (s: string) => {
    if (s === "CONNECTED") return "bg-success";
    if (s === "ERROR") return "bg-error";
    return "bg-text-muted";
  };

  const existingNames = new Set(servers.map((s) => s.name));

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

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-4">
        <button onClick={() => setTab("servers")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tab === "servers" ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-alt"}`}>Серверы ({servers.length})</button>
        <button onClick={() => setTab("catalog")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tab === "catalog" ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-alt"}`}><Bookmark className="h-3 w-3 inline mr-1" />Каталог</button>
        <button onClick={() => setTab("logs")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tab === "logs" ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-alt"}`}><FileText className="h-3 w-3 inline mr-1" />Tool Logs</button>
      </div>

      {/* ── Search & Filters ── */}
      {(tab === "servers" || tab === "logs") && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "servers" ? "Поиск по названию или URL..." : "Поиск по инструменту или серверу..."}
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>
          {tab === "servers" && (
            <>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="all">Все статусы</option>
                <option value="CONNECTED">Подключён</option>
                <option value="DISCONNECTED">Отключён</option>
                <option value="ERROR">Ошибка</option>
              </select>
              <select
                value={filterTransport}
                onChange={(e) => setFilterTransport(e.target.value)}
                className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="all">Все протоколы</option>
                <option value="STREAMABLE_HTTP">Streamable HTTP</option>
                <option value="SSE">SSE</option>
              </select>
            </>
          )}
        </div>
      )}

      {/* ── Tool Logs ── */}
      {tab === "logs" && (
        <div className="space-y-2">
          {pagedLogs.map((log) => (
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
          {filteredLogs.length === 0 && <p className="text-sm text-text-muted text-center py-8">Нет логов вызовов</p>}
          {totalLogPages > 1 && (
            <Pagination page={logPage} total={totalLogPages} count={filteredLogs.length} perPage={LOGS_PER_PAGE} onChange={setLogPage} />
          )}
        </div>
      )}

      {/* ── Add Server Form ── */}
      {tab === "servers" && adding && (
        <div className="bg-surface border border-accent/30 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Новый MCP-сервер</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Название" value={newServer.name} onChange={(e) => setNewServer({ ...newServer, name: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <input placeholder="URL (http://...)" value={newServer.url} onChange={(e) => setNewServer({ ...newServer, url: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <select value={newServer.transport} onChange={(e) => setNewServer({ ...newServer, transport: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent">
              <option value="STREAMABLE_HTTP">Streamable HTTP</option>
              <option value="SSE">SSE (legacy)</option>
            </select>
            <input placeholder="API Key (опционально)" type="password" value={newServer.apiKey} onChange={(e) => setNewServer({ ...newServer, apiKey: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
          </div>
          <div className="mt-3">
            <Button variant="gradient" size="sm" onClick={handleCreate}><Save className="h-3.5 w-3.5" /> Создать</Button>
          </div>
        </div>
      )}

      {/* ── Servers List ── */}
      {tab === "servers" && (
        <div className="space-y-3">
          {filteredServers.length > 0 && filteredServers.length !== servers.length && (
            <p className="text-xs text-text-muted">
              Найдено: {filteredServers.length} из {servers.length}
            </p>
          )}
          {pagedServers.map((s) => (
            <div key={s.id} className={`bg-surface border border-border rounded-2xl p-5 ${!s.isEnabled ? "opacity-60" : ""}`}>
              {editingId === s.id ? (
                /* ── Inline Edit Mode ── */
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-text-primary">Редактирование</h3>
                    <button onClick={handleCancelEdit} className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <input placeholder="Название" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
                    <input placeholder="URL" value={editData.url} onChange={(e) => setEditData({ ...editData, url: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
                    <select value={editData.transport} onChange={(e) => setEditData({ ...editData, transport: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent">
                      <option value="STREAMABLE_HTTP">Streamable HTTP</option>
                      <option value="SSE">SSE (legacy)</option>
                    </select>
                    <input placeholder="Новый API Key (не менять — оставить пустым)" type="password" value={editData.apiKey} onChange={(e) => setEditData({ ...editData, apiKey: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button variant="gradient" size="sm" onClick={handleSaveEdit} isLoading={saving}><Save className="h-3.5 w-3.5" /> Сохранить</Button>
                    <Button variant="secondary" size="sm" onClick={handleCancelEdit}>Отмена</Button>
                  </div>
                </div>
              ) : (
                /* ── View Mode ── */
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {s.status === "CONNECTED" ? <Wifi className="h-4 w-4 text-success" /> : <WifiOff className="h-4 w-4 text-text-muted" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">{s.name}</span>
                        <div className={`h-2 w-2 rounded-full ${statusColor(s.status)}`} />
                        <Badge variant="default">{s.transport === "STREAMABLE_HTTP" ? "HTTP" : "SSE"}</Badge>
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
                    <button
                      onClick={() => handleToggleEnabled(s.id, s.isEnabled)}
                      title={s.isEnabled ? "Отключить для пользователей" : "Включить для пользователей"}
                      className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${s.isEnabled ? "text-success hover:text-orange-500 hover:bg-orange-500/10" : "text-text-muted hover:text-success hover:bg-success/10"}`}
                    >
                      {s.isEnabled ? <ToggleRight className="h-4.5 w-4.5" /> : <ToggleLeft className="h-4.5 w-4.5" />}
                    </button>
                    <button onClick={() => handleStartEdit(s)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDelete(s.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {filteredServers.length === 0 && servers.length > 0 && (
            <p className="text-sm text-text-muted text-center py-8">Нет серверов по заданным фильтрам</p>
          )}
          {servers.length === 0 && <p className="text-sm text-text-muted text-center py-8">Глобальные MCP-серверы не добавлены</p>}
          {totalServerPages > 1 && (
            <Pagination page={serverPage} total={totalServerPages} count={filteredServers.length} perPage={SERVERS_PER_PAGE} onChange={setServerPage} />
          )}
        </div>
      )}

      {/* ── Catalog (Presets) ── */}
      {tab === "catalog" && (
        <div>
          <p className="text-sm text-text-muted mb-4">
            Топ-10 популярных MCP-серверов. Нажмите &laquo;Добавить&raquo; для быстрой настройки.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MCP_PRESETS.map((preset, idx) => {
              const alreadyAdded = existingNames.has(preset.name);
              return (
                <div key={preset.name} className="bg-surface border border-border rounded-2xl p-5 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: preset.categoryColor }}>
                        {preset.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">{preset.name}</h3>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ backgroundColor: preset.categoryColor + "18", color: preset.categoryColor }}>
                          {preset.category}
                        </span>
                      </div>
                    </div>
                    <a
                      href={preset.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text-muted hover:text-accent transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <p className="text-xs text-text-secondary mb-3 flex-1">{preset.description}</p>

                  <div className="bg-surface-alt rounded-lg p-2.5 mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Установка</span>
                      <button
                        onClick={() => handleCopyCommand(preset.setupCommand, idx)}
                        className="text-text-muted hover:text-accent transition-colors cursor-pointer"
                      >
                        {copiedIdx === idx ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    <code className="text-[11px] text-text-primary font-mono break-all leading-relaxed">{preset.setupCommand}</code>
                  </div>

                  {preset.envVars.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {preset.envVars.map((v) => (
                        <span key={v} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-alt text-text-muted border border-border">{v}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                    <Badge variant="default">{preset.transport === "STREAMABLE_HTTP" ? "HTTP" : "SSE"}</Badge>
                    {alreadyAdded ? (
                      <span className="text-xs text-success font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" /> Добавлен
                      </span>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => handleAddPreset(preset)}>
                        <Plus className="h-3 w-3" /> Добавить
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Pagination({ page, total, count, perPage, onChange }: { page: number; total: number; count: number; perPage: number; onChange: (p: number) => void }) {
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, count);

  return (
    <div className="flex items-center justify-between pt-3">
      <span className="text-xs text-text-muted">
        {from}&ndash;{to} из {count}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs text-text-secondary px-2">
          {page} / {total}
        </span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= total}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
