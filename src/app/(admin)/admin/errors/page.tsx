"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, Download } from "lucide-react";

interface ErrorEntry {
  id: string;
  route: string;
  method: string;
  message: string;
  stack: string | null;
  userId: string | null;
  metadata: unknown;
  createdAt: string;
}

export default function AdminErrorsPage() {
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [routeFilter, setRouteFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchErrors = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (routeFilter) params.set("route", routeFilter);
    const res = await fetch(`/api/admin/errors?${params}`);
    const data = await res.json();
    setErrors(data.errors || []);
    setTotal(data.total || 0);
    setLoading(false);
  };

  useEffect(() => { fetchErrors(); }, [page]);

  const totalPages = Math.ceil(total / 50);

  const methodColor = (m: string) => {
    if (m === "GET") return "text-accent";
    if (m === "POST") return "text-success";
    if (m === "PUT" || m === "PATCH") return "text-warning";
    if (m === "DELETE") return "text-error";
    return "text-text-secondary";
  };

  const handleExport = async () => {
    const params = new URLSearchParams({ format: "csv", limit: "10000" });
    if (routeFilter) params.set("route", routeFilter);
    const res = await fetch(`/api/admin/errors?${params}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `errors-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Логи ошибок</h1>
          <p className="text-sm text-text-muted mt-1">Ошибки API и системные сбои</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4" /> Экспорт CSV
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        <input placeholder="Фильтр по маршруту" value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)} className="h-9 w-64 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        <Button variant="secondary" size="sm" onClick={() => { setPage(1); fetchErrors(); }}>Применить</Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="bg-surface border border-border rounded-xl p-4 animate-pulse h-16" />)}</div>
      ) : (
        <>
          <div className="space-y-2">
            {errors.map((e) => (
              <div key={e.id} className="bg-surface border border-border rounded-xl overflow-hidden">
                <button onClick={() => setExpanded(expanded === e.id ? null : e.id)} className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-surface-alt/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <AlertTriangle className="h-4 w-4 text-error shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${methodColor(e.method)}`}>{e.method}</span>
                        <span className="text-sm text-text-secondary font-mono truncate">{e.route}</span>
                      </div>
                      <p className="text-xs text-error mt-0.5 truncate">{e.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {e.userId && <Badge variant="default">user</Badge>}
                    <span className="text-xs text-text-muted">{new Date(e.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </button>
                {expanded === e.id && (
                  <div className="border-t border-border p-4 bg-surface-alt/30">
                    <div className="space-y-2">
                      {e.userId && <p className="text-xs text-text-muted">User ID: <span className="font-mono text-text-secondary">{e.userId}</span></p>}
                      {e.stack && (
                        <div>
                          <p className="text-xs text-text-muted mb-1">Stack trace:</p>
                          <pre className="text-xs text-error/80 bg-surface p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono max-h-48">{e.stack}</pre>
                        </div>
                      )}
                      {e.metadata != null && (
                        <div>
                          <p className="text-xs text-text-muted mb-1">Metadata:</p>
                          <pre className="text-xs text-text-secondary bg-surface p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">{JSON.stringify(e.metadata, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {errors.length === 0 && <p className="text-sm text-text-muted text-center py-8">Ошибок не найдено</p>}
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
