"use client";

import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface AuditEntry {
  id: string;
  actorId: string;
  action: string;
  target: string;
  targetId: string | null;
  details: unknown;
  ip: string | null;
  createdAt: string;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (actionFilter) params.set("action", actionFilter);
    const res = await fetch(`/api/admin/audit-log?${params}`);
    const data = await res.json();
    setLogs(data.logs || []);
    setTotal(data.total || 0);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [page]);

  const totalPages = Math.ceil(total / 50);

  const actionColor = (a: string) => {
    if (a.startsWith("delete")) return "text-error";
    if (a.startsWith("create")) return "text-success";
    if (a.startsWith("update")) return "text-warning";
    return "text-text-secondary";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary mb-1">Аудит-лог</h1>
          <p className="text-sm text-text-muted">Все действия администраторов</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => {
          const params = new URLSearchParams({ format: "csv", limit: "10000" });
          if (actionFilter) params.set("action", actionFilter);
          window.open(`/api/admin/audit-log?${params}`, "_blank");
        }}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        <input placeholder="Фильтр по действию" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="h-9 w-64 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        <Button variant="secondary" size="sm" onClick={() => { setPage(1); fetchLogs(); }}>Применить</Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="bg-surface border border-border rounded-xl p-4 animate-pulse h-14" />)}</div>
      ) : (
        <>
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${actionColor(l.action)}`}>{l.action}</span>
                      <Badge variant="default">{l.target}</Badge>
                      {l.targetId && <span className="text-xs text-text-muted font-mono">{l.targetId.slice(0, 8)}...</span>}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      Актор: {l.actorId.slice(0, 8)}...
                      {l.ip && <> &middot; IP: {l.ip}</>}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-text-muted">{new Date(l.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
            {logs.length === 0 && <p className="text-sm text-text-muted text-center py-8">Нет записей</p>}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>Назад</Button>
              <span className="text-sm text-text-muted">{page} / {totalPages}</span>
              <Button variant="secondary" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>Далее</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
