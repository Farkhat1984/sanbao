"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/Badge";

interface Analytics {
  period: string;
  dailyMessages: { date: string; messages: number; tokens: number }[];
  registrationsByDay: Record<string, number>;
  newUsersTotal: number;
  topUsers: { userId: string; name: string; tokens: number; messages: number }[];
  providerDistribution?: { provider: string; requests: number; tokens: number; cost: number }[];
  costPerUser?: { userId: string; name: string; cost: number }[];
  totalCost?: number;
  anomalies?: { userId: string; name: string; cost: number }[];
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [period, setPeriod] = useState("30d");

  useEffect(() => {
    fetch(`/api/admin/analytics?period=${period}`)
      .then((r) => r.json())
      .then(setData);
  }, [period]);

  if (!data) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-40" />)}</div>;
  }

  const maxMsg = Math.max(...data.dailyMessages.map((d) => d.messages), 1);
  const maxTok = Math.max(...data.dailyMessages.map((d) => d.tokens), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Аналитика</h1>
          <p className="text-sm text-text-muted mt-1">Статистика использования за период</p>
        </div>
        <div className="flex gap-1">
          {["7d", "30d", "90d"].map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${period === p ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-alt"}`}>{p}</button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="text-xs text-text-muted">Новых пользователей</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{data.newUsersTotal}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="text-xs text-text-muted">Сообщений за период</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{data.dailyMessages.reduce((s, d) => s + d.messages, 0).toLocaleString()}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="text-xs text-text-muted">Токенов за период</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{data.dailyMessages.reduce((s, d) => s + d.tokens, 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Messages chart (bar) */}
      <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Сообщения / день</h2>
        <div className="flex items-end gap-[2px] h-32">
          {data.dailyMessages.map((d) => (
            <div key={d.date} className="flex-1 group relative">
              <div className="bg-accent/80 rounded-t-sm transition-all" style={{ height: `${(d.messages / maxMsg) * 100}%`, minHeight: d.messages > 0 ? "2px" : "0" }} />
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary whitespace-nowrap shadow-md z-10">
                {d.date}: {d.messages} сообщ.
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tokens chart */}
      <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Токены / день</h2>
        <div className="flex items-end gap-[2px] h-32">
          {data.dailyMessages.map((d) => (
            <div key={d.date} className="flex-1 group relative">
              <div className="bg-legal-ref/80 rounded-t-sm transition-all" style={{ height: `${(d.tokens / maxTok) * 100}%`, minHeight: d.tokens > 0 ? "2px" : "0" }} />
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary whitespace-nowrap shadow-md z-10">
                {d.date}: {d.tokens.toLocaleString()} ток.
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Provider distribution */}
      {data.providerDistribution && data.providerDistribution.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Распределение по провайдерам</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-xs text-text-muted font-medium">Провайдер</th>
                  <th className="text-right px-3 py-2 text-xs text-text-muted font-medium">Запросов</th>
                  <th className="text-right px-3 py-2 text-xs text-text-muted font-medium">Токенов</th>
                  <th className="text-right px-3 py-2 text-xs text-text-muted font-medium">Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {data.providerDistribution.map((p) => (
                  <tr key={p.provider} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-text-primary font-medium">{p.provider}</td>
                    <td className="px-3 py-2 text-right text-text-secondary">{p.requests.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-text-secondary">{p.tokens.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-accent">${p.cost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Financial: total cost + anomalies */}
      {data.totalCost !== undefined && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-surface border border-border rounded-2xl p-5">
            <p className="text-xs text-text-muted">Общая стоимость за период</p>
            <p className="text-2xl font-bold text-accent mt-1">${data.totalCost.toFixed(4)}</p>
          </div>
          {data.anomalies && data.anomalies.length > 0 && (
            <div className="bg-surface border border-error/30 rounded-2xl p-5">
              <p className="text-xs text-error mb-2">Аномальный расход (3x выше среднего)</p>
              {data.anomalies.map((a) => (
                <div key={a.userId} className="flex justify-between py-1">
                  <span className="text-sm text-text-primary">{a.name}</span>
                  <span className="text-sm text-error font-medium">${a.cost.toFixed(4)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top users */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Топ-10 по токенам</h2>
        <div className="space-y-2">
          {data.topUsers.map((u, i) => (
            <div key={u.userId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-muted w-5">{i + 1}.</span>
                <span className="text-sm text-text-primary">{u.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="default">{u.messages} сообщ.</Badge>
                <span className="text-sm font-medium text-text-primary">{u.tokens.toLocaleString()} ток.</span>
              </div>
            </div>
          ))}
          {data.topUsers.length === 0 && <p className="text-sm text-text-muted text-center py-4">Нет данных</p>}
        </div>
      </div>
    </div>
  );
}
