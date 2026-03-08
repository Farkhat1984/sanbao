"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, FloppyDisk, Trash, WebhooksLogo, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface WebhookEntry {
  id: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: string;
}

const AVAILABLE_EVENTS = [
  "user.created", "user.deleted", "user.banned",
  "subscription.changed", "subscription.expired",
  "payment.completed", "payment.failed",
];

const WEBHOOKS_PER_PAGE = 25;

export default function AdminWebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [adding, setAdding] = useState(false);
  const [newWh, setNewWh] = useState({ url: "", events: [] as string[] });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(WEBHOOKS_PER_PAGE),
    });
    const res = await fetch(`/api/admin/webhooks?${params}`);
    const data = await res.json();
    setWebhooks(data.webhooks || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleEvent = (ev: string) => {
    setNewWh((prev) => ({
      ...prev,
      events: prev.events.includes(ev) ? prev.events.filter((e) => e !== ev) : [...prev.events, ev],
    }));
  };

  const handleCreate = async () => {
    const res = await fetch("/api/admin/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newWh),
    });
    if (res.ok) { setAdding(false); setNewWh({ url: "", events: [] }); fetchData(); }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/admin/webhooks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить вебхук?")) return;
    await fetch(`/api/admin/webhooks/${id}`, { method: "DELETE" });
    fetchData();
  };

  if (loading) return <div className="space-y-4">{[...Array(2)].map((_, i) => <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-24" />)}</div>;

  const totalPages = Math.ceil(total / WEBHOOKS_PER_PAGE);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">Вебхуки</h1>
          <p className="text-sm text-text-secondary mt-1">HTTP-уведомления о событиях ({total})</p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => setAdding(!adding)}><Plus className="h-4 w-4" weight="duotone" /> Добавить</Button>
      </div>

      {adding && (
        <div className="bg-surface border border-accent/30 rounded-2xl p-5 mb-4">
          <input placeholder="URL (https://...)" value={newWh.url} onChange={(e) => setNewWh({ ...newWh, url: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent mb-3" />
          <p className="text-xs text-text-secondary mb-2">События:</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {AVAILABLE_EVENTS.map((ev) => (
              <button key={ev} onClick={() => toggleEvent(ev)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${newWh.events.includes(ev) ? "bg-accent text-white" : "bg-surface-alt text-text-secondary hover:bg-surface-alt/80"}`}>{ev}</button>
            ))}
          </div>
          <Button variant="gradient" size="sm" onClick={handleCreate}><FloppyDisk className="h-3.5 w-3.5" weight="duotone" /> Создать</Button>
        </div>
      )}

      <div className="space-y-3">
        {webhooks.map((w) => (
          <div key={w.id} className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <WebhooksLogo className="h-4 w-4 text-text-secondary" weight="duotone" />
                <span className="text-sm font-mono text-text-primary">{w.url}</span>
                <div className={`h-2 w-2 rounded-full ${w.isActive ? "bg-success" : "bg-text-muted"}`} />
              </div>
              <div className="flex items-center gap-1">
                <Button variant="secondary" size="sm" onClick={() => handleToggle(w.id, w.isActive)}>{w.isActive ? "Откл." : "Вкл."}</Button>
                <button onClick={() => handleDelete(w.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-error hover:bg-error/10 transition-colors cursor-pointer"><Trash className="h-3.5 w-3.5" weight="duotone" /></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {w.events.map((ev) => <Badge key={ev} variant="default">{ev}</Badge>)}
            </div>
          </div>
        ))}
        {webhooks.length === 0 && <p className="text-sm text-text-secondary text-center py-8">Вебхуки не настроены</p>}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <span className="text-xs text-text-secondary">{total} вебхуков</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-alt disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
              >
                <CaretLeft className="h-4 w-4" weight="duotone" />
              </button>
              <span className="text-sm text-text-secondary">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-alt disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
              >
                <CaretRight className="h-4 w-4" weight="duotone" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
