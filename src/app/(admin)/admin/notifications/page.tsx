"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api-client";

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

interface NotificationsResponse {
  notifications: Notification[];
  nextCursor?: string;
  hasMore?: boolean;
}

const TYPES = ["INFO", "WARNING", "ERROR", "MAINTENANCE", "UPDATE", "BILLING"];
const NOTIFICATIONS_LIMIT = 20;

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", type: "INFO", isGlobal: true });

  // Cursor-based infinite scroll state
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchInitial = async () => {
    setLoading(true);
    try {
      const data = await api.get<NotificationsResponse>(`/api/admin/notifications?limit=${NOTIFICATIONS_LIMIT}`);
      setNotifications(data.notifications || []);
      setNextCursor(data.nextCursor ?? null);
      setHasMore(data.hasMore ?? false);
    } catch {
      /* network error — keep empty state */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInitial(); }, []);

  // Load more notifications
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    api.get<NotificationsResponse>(`/api/admin/notifications?limit=${NOTIFICATIONS_LIMIT}&cursor=${nextCursor}`)
      .then((data) => {
        const newItems = data.notifications || [];
        setNotifications((prev) => [...prev, ...newItems]);
        setNextCursor(data.nextCursor ?? null);
        setHasMore(data.hasMore ?? false);
      })
      .catch(() => { /* silently handle */ })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, nextCursor]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const handleSend = async () => {
    if (!form.title || !form.message) return;
    setSending(true);
    await api.post("/api/admin/notifications", form);
    setSending(false);
    setForm({ title: "", message: "", type: "INFO", isGlobal: true });
    // Reset and re-fetch from the beginning to show new notification at top
    setNotifications([]);
    setNextCursor(null);
    setHasMore(false);
    fetchInitial();
  };

  const typeColor = (t: string) => {
    if (t === "ERROR") return "text-error";
    if (t === "WARNING") return "text-warning";
    if (t === "MAINTENANCE") return "text-legal-ref";
    return "text-accent";
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)] mb-1">Уведомления</h1>
      <p className="text-sm text-text-secondary mb-6">Массовые и глобальные уведомления</p>

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
                    <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{n.message}</p>
                  </div>
                </div>
                <span className="text-xs text-text-secondary">{new Date(n.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
            {notifications.length === 0 && <p className="text-sm text-text-secondary text-center py-8">Нет уведомлений</p>}
          </div>

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-6">
              {loadingMore && (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Загрузка...</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
