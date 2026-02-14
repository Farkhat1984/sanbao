"use client";

import { useState, useEffect } from "react";
import { Plus, Save, Trash2, Webhook } from "lucide-react";
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

export default function AdminWebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newWh, setNewWh] = useState({ url: "", events: [] as string[] });

  const fetchData = async () => {
    const res = await fetch("/api/admin/webhooks");
    setWebhooks(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Вебхуки</h1>
          <p className="text-sm text-text-muted mt-1">HTTP-уведомления о событиях</p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => setAdding(!adding)}><Plus className="h-4 w-4" /> Добавить</Button>
      </div>

      {adding && (
        <div className="bg-surface border border-accent/30 rounded-2xl p-5 mb-4">
          <input placeholder="URL (https://...)" value={newWh.url} onChange={(e) => setNewWh({ ...newWh, url: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent mb-3" />
          <p className="text-xs text-text-muted mb-2">События:</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {AVAILABLE_EVENTS.map((ev) => (
              <button key={ev} onClick={() => toggleEvent(ev)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${newWh.events.includes(ev) ? "bg-accent text-white" : "bg-surface-alt text-text-secondary hover:bg-surface-alt/80"}`}>{ev}</button>
            ))}
          </div>
          <Button variant="gradient" size="sm" onClick={handleCreate}><Save className="h-3.5 w-3.5" /> Создать</Button>
        </div>
      )}

      <div className="space-y-3">
        {webhooks.map((w) => (
          <div key={w.id} className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Webhook className="h-4 w-4 text-text-muted" />
                <span className="text-sm font-mono text-text-primary">{w.url}</span>
                <div className={`h-2 w-2 rounded-full ${w.isActive ? "bg-success" : "bg-text-muted"}`} />
              </div>
              <div className="flex items-center gap-1">
                <Button variant="secondary" size="sm" onClick={() => handleToggle(w.id, w.isActive)}>{w.isActive ? "Откл." : "Вкл."}</Button>
                <button onClick={() => handleDelete(w.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {w.events.map((ev) => <Badge key={ev} variant="default">{ev}</Badge>)}
            </div>
          </div>
        ))}
        {webhooks.length === 0 && <p className="text-sm text-text-muted text-center py-8">Вебхуки не настроены</p>}
      </div>
    </div>
  );
}
