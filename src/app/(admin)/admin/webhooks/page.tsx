"use client";

import { useState } from "react";
import { Plus, Save, Trash2, Webhook } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminListSkeleton } from "@/components/admin/AdminListSkeleton";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { useAdminList } from "@/hooks/useAdminList";

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
  const { items: webhooks, loading, page, total, totalPages, setPage, refetch } =
    useAdminList<WebhookEntry>({
      endpoint: "/api/admin/webhooks",
      perPage: WEBHOOKS_PER_PAGE,
      dataKey: "webhooks",
    });

  const [adding, setAdding] = useState(false);
  const [newWh, setNewWh] = useState({ url: "", events: [] as string[] });

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
    if (res.ok) { setAdding(false); setNewWh({ url: "", events: [] }); refetch(); }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/admin/webhooks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить вебхук?")) return;
    await fetch(`/api/admin/webhooks/${id}`, { method: "DELETE" });
    refetch();
  };

  if (loading) return <AdminListSkeleton rows={2} height="h-24" />;

  return (
    <div>
      <AdminPageHeader
        title="Вебхуки"
        subtitle="HTTP-уведомления о событиях"
        count={total}
        action={
          <Button variant="gradient" size="sm" onClick={() => setAdding(!adding)}>
            <Plus className="h-4 w-4" /> Добавить
          </Button>
        }
      />

      {adding && (
        <div className="bg-surface border border-accent/30 rounded-2xl p-5 mb-4">
          <input placeholder="URL (https://...)" value={newWh.url} onChange={(e) => setNewWh({ ...newWh, url: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent mb-3" />
          <p className="text-xs text-text-secondary mb-2">События:</p>
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
                <Webhook className="h-4 w-4 text-text-secondary" />
                <span className="text-sm font-mono text-text-primary">{w.url}</span>
                <div className={`h-2 w-2 rounded-full ${w.isActive ? "bg-success" : "bg-text-muted"}`} />
              </div>
              <div className="flex items-center gap-1">
                <Button variant="secondary" size="sm" onClick={() => handleToggle(w.id, w.isActive)}>{w.isActive ? "Откл." : "Вкл."}</Button>
                <button onClick={() => handleDelete(w.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-error hover:bg-error/10 transition-colors cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {w.events.map((ev) => <Badge key={ev} variant="default">{ev}</Badge>)}
            </div>
          </div>
        ))}
        {webhooks.length === 0 && <AdminEmptyState message="Вебхуки не настроены" />}

        <AdminPagination
          page={page}
          totalPages={totalPages}
          total={total}
          label="вебхуков"
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
