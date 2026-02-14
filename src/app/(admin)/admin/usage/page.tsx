"use client";

import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface TokenLogEntry {
  id: string;
  userId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  createdAt: string;
}

export default function AdminUsagePage() {
  const [logs, setLogs] = useState<TokenLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState({ inputTokens: 0, outputTokens: 0, cost: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (userId) params.set("userId", userId);
    const res = await fetch(`/api/admin/token-usage?${params}`);
    const data = await res.json();
    setLogs(data.logs || []);
    setTotal(data.total || 0);
    setTotals(data.totals || { inputTokens: 0, outputTokens: 0, cost: 0 });
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [page]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary mb-1">Расход токенов</h1>
          <p className="text-sm text-text-muted">Детальная статистика использования AI</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => {
          const params = new URLSearchParams({ format: "csv", limit: "10000" });
          if (userId) params.set("userId", userId);
          window.open(`/api/admin/token-usage?${params}`, "_blank");
        }}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="text-xs text-text-muted">Input токенов</p>
          <p className="text-xl font-bold text-text-primary mt-1">{totals.inputTokens.toLocaleString()}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="text-xs text-text-muted">Output токенов</p>
          <p className="text-xl font-bold text-text-primary mt-1">{totals.outputTokens.toLocaleString()}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="text-xs text-text-muted">Стоимость</p>
          <p className="text-xl font-bold text-accent mt-1">${totals.cost.toFixed(4)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <input placeholder="Фильтр по userId" value={userId} onChange={(e) => setUserId(e.target.value)} className="h-9 w-64 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        <Button variant="secondary" size="sm" onClick={() => { setPage(1); fetchData(); }}>Применить</Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="bg-surface border border-border rounded-xl p-4 animate-pulse h-12" />)}</div>
      ) : (
        <>
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-alt">
                  <th className="text-left px-4 py-3 text-xs text-text-muted font-medium">Дата</th>
                  <th className="text-left px-4 py-3 text-xs text-text-muted font-medium">Провайдер</th>
                  <th className="text-left px-4 py-3 text-xs text-text-muted font-medium">Модель</th>
                  <th className="text-right px-4 py-3 text-xs text-text-muted font-medium">Input</th>
                  <th className="text-right px-4 py-3 text-xs text-text-muted font-medium">Output</th>
                  <th className="text-right px-4 py-3 text-xs text-text-muted font-medium">Цена</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-text-secondary">{new Date(l.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-3"><Badge variant="default">{l.provider}</Badge></td>
                    <td className="px-4 py-3 font-mono text-text-secondary">{l.model}</td>
                    <td className="px-4 py-3 text-right text-text-primary">{l.inputTokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-text-primary">{l.outputTokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-accent font-medium">${l.cost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
