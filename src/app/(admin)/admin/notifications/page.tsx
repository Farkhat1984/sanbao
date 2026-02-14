"use client";

import { useState, useEffect } from "react";
import { Bell, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isGlobal: boolean;
  userId: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPES = ["INFO", "WARNING", "ERROR", "MAINTENANCE", "UPDATE", "BILLING"];

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", type: "INFO", isGlobal: true });

  const fetchData = async () => {
    const res = await fetch(`/api/admin/notifications?page=${page}&limit=20`);
    const data = await res.json();
    setNotifications(data.notifications || []);
    setTotal(data.total || 0);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [page]);

  const handleSend = async () => {
    if (!form.title || !form.message) return;
    setSending(true);
    await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSending(false);
    setForm({ title: "", message: "", type: "INFO", isGlobal: true });
    fetchData();
  };

  const totalPages = Math.ceil(total / 20);

  const typeColor = (t: string) => {
    if (t === "ERROR") return "text-error";
    if (t === "WARNING") return "text-warning";
    if (t === "MAINTENANCE") return "text-legal-ref";
    return "text-accent";
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-text-primary mb-1">Уведомления</h1>
      <p className="text-sm text-text-muted mb-6">Массовые и глобальные уведомления</p>

      {/* Send form */}
      <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Новое уведомление</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          <input placeholder="Заголовок" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent">
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input type="checkbox" checked={form.isGlobal} onChange={(e) => setForm({ ...form, isGlobal: e.target.checked })} className="rounded" />
            Глобальное (баннер)
          </label>
        </div>
        <textarea placeholder="Текст уведомления" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full h-20 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none mb-3" />
        <Button variant="gradient" size="sm" onClick={handleSend} isLoading={sending}><Send className="h-3.5 w-3.5" /> Отправить</Button>
      </div>

      {/* History */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="bg-surface border border-border rounded-xl p-4 animate-pulse h-16" />)}</div>
      ) : (
        <>
          <div className="space-y-2">
            {notifications.map((n) => (
              <div key={n.id} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className={`h-4 w-4 ${typeColor(n.type)}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{n.title}</span>
                      <Badge variant="default">{n.type}</Badge>
                      {n.isGlobal && <Badge variant="accent">Глобальное</Badge>}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{n.message}</p>
                  </div>
                </div>
                <span className="text-xs text-text-muted">{new Date(n.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
            {notifications.length === 0 && <p className="text-sm text-text-muted text-center py-8">Нет уведомлений</p>}
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
