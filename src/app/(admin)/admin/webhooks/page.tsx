"use client";

import { useState } from "react";
import { Plus, Save, Webhook } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminListSkeleton } from "@/components/admin/AdminListSkeleton";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";
import { useAdminList } from "@/hooks/useAdminList";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { api } from "@/lib/api-client";

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

  const { handleToggle, handleDelete } = useAdminCrud({
    endpoint: "/api/admin/webhooks",
    refetch,
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
    try {
      await api.post("/api/admin/webhooks", newWh);
      setAdding(false);
      setNewWh({ url: "", events: [] });
      refetch();
    } catch { /* validation error — stay on form */ }
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
          <Input placeholder="URL (https://...)" value={newWh.url} onChange={(e) => setNewWh({ ...newWh, url: e.target.value })} className="h-9 bg-surface-alt mb-3" />
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
                <AdminDeleteButton onClick={() => handleDelete(w.id, "Удалить вебхук?")} />
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
