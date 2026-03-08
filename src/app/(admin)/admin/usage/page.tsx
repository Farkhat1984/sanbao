"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, Search, Calendar } from "lucide-react";
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
  revenue: number;
  profit: number;
  createdAt: string;
}

interface UsageData {
  logs: TokenLogEntry[];
  total: number;
  totals: { inputTokens: number; outputTokens: number; cost: number; revenue: number; profit: number };
  providers: string[];
  dateFrom: string;
  dateTo: string;
}

function firstOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const PAGE_SIZE = 50;

export default function AdminUsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [provider, setProvider] = useState("");
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
    if (userId) params.set("userId", userId);
    if (provider) params.set("provider", provider);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/admin/token-usage?${params}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  }, [userId, provider, from, to]);

  useEffect(() => { fetchData(page); }, [page, fetchData]);

  const applyFilters = () => { setPage(1); fetchData(1); };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const totals = data?.totals || { inputTokens: 0, outputTokens: 0, cost: 0, revenue: 0, profit: 0 };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)] mb-1">Расход токенов</h1>
          <p className="text-sm text-text-secondary">Детальная статистика использования AI</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => {
          const params = new URLSearchParams({ format: "csv", limit: "10000" });
          if (userId) params.set("userId", userId);
          if (provider) params.set("provider", provider);
          if (from) params.set("from", from);
          if (to) params.set("to", to);
          window.open(`/api/admin/token-usage?${params}`, "_blank");
        }}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="text-xs text-text-secondary">Input токенов</p>
          <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)] mt-1">{totals.inputTokens.toLocaleString()}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="text-xs text-text-secondary">Output токенов</p>
          <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)] mt-1">{totals.outputTokens.toLocaleString()}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="text-xs text-text-secondary">Себестоимость</p>
          <p className="text-xl font-bold text-accent mt-1">${totals.cost.toFixed(4)}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="text-xs text-text-secondary">Выручка</p>
          <p className="text-xl font-bold text-success mt-1">${totals.revenue.toFixed(4)}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="text-xs text-text-secondary">Прибыль</p>
          <p className={`text-xl font-bold mt-1 ${totals.profit >= 0 ? "text-success" : "text-error"}`}>
            ${totals.profit.toFixed(4)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="text-xs text-text-secondary block mb-1">User ID</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
            <input
              placeholder="Фильтр по userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="h-9 w-52 pl-9 pr-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-1">Провайдер</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
          >
            <option value="">Все</option>
            {data?.providers.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-1 flex items-center gap-1">
            <Calendar className="h-3 w-3" /> От
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-1 flex items-center gap-1">
            <Calendar className="h-3 w-3" /> До
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={applyFilters}>Применить</Button>
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
                  <th className="text-left px-4 py-3 text-xs text-text-secondary font-medium">Дата</th>
                  <th className="text-left px-4 py-3 text-xs text-text-secondary font-medium">Провайдер</th>
                  <th className="text-left px-4 py-3 text-xs text-text-secondary font-medium">Модель</th>
                  <th className="text-right px-4 py-3 text-xs text-text-secondary font-medium">Input</th>
                  <th className="text-right px-4 py-3 text-xs text-text-secondary font-medium">Output</th>
                  <th className="text-right px-4 py-3 text-xs text-text-secondary font-medium">Себест.</th>
                  <th className="text-right px-4 py-3 text-xs text-text-secondary font-medium">Выручка</th>
                  <th className="text-right px-4 py-3 text-xs text-text-secondary font-medium">Прибыль</th>
                </tr>
              </thead>
              <tbody>
                {data?.logs.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-text-secondary">{new Date(l.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-3"><Badge variant="default">{l.provider}</Badge></td>
                    <td className="px-4 py-3 font-mono text-text-secondary text-xs">{l.model}</td>
                    <td className="px-4 py-3 text-right text-text-primary">{l.inputTokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-text-primary">{l.outputTokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-accent font-medium">${l.cost.toFixed(4)}</td>
                    <td className="px-4 py-3 text-right text-success font-medium">${l.revenue.toFixed(4)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${l.profit >= 0 ? "text-success" : "text-error"}`}>${l.profit.toFixed(4)}</td>
                  </tr>
                ))}
                {data?.logs.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-text-secondary">Нет данных за выбранный период</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-text-secondary">{data?.total.toLocaleString()} записей</span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>Назад</Button>
                <span className="text-sm text-text-secondary">{page} / {totalPages}</span>
                <Button variant="secondary" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>Далее</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
