"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LogOut, ChevronLeft, ChevronRight } from "lucide-react";

interface SessionEntry {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  expires: string;
  createdAt?: string;
}

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const SESSIONS_PER_PAGE = 50;

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(SESSIONS_PER_PAGE),
    });
    const res = await fetch(`/api/admin/sessions?${params}`);
    const data = await res.json();
    setSessions(data.sessions || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleRevoke = async (id: string) => {
    if (!confirm("Завершить сессию пользователя?")) return;
    await fetch(`/api/admin/sessions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: id }),
    });
    fetchSessions();
  };

  const handleRevokeAll = async () => {
    if (!confirm("Завершить ВСЕ сессии? Пользователям придётся войти заново.")) return;
    await fetch(`/api/admin/sessions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    fetchSessions();
  };

  const isExpired = (expires: string) => new Date(expires) < new Date();

  if (loading) {
    return <div className="space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-16" />)}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">Сессии</h1>
          <p className="text-sm text-text-secondary mt-1">Активные сессии пользователей ({total})</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleRevokeAll}>
          <LogOut className="h-4 w-4" /> Завершить все
        </Button>
      </div>

      <div className="space-y-2">
        {sessions.map((s) => (
          <div key={s.id} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${isExpired(s.expires) ? "bg-text-muted" : "bg-success"}`} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{s.userName || s.userEmail}</span>
                  {isExpired(s.expires) ? <Badge variant="default">Истекла</Badge> : <Badge variant="default">Активна</Badge>}
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  {s.userEmail} &middot; Истекает: {new Date(s.expires).toLocaleString("ru-RU")}
                </p>
              </div>
            </div>
            <button onClick={() => handleRevoke(s.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-error hover:bg-error/10 transition-colors cursor-pointer" title="Завершить сессию">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {sessions.length === 0 && <p className="text-sm text-text-secondary text-center py-8">Нет активных сессий</p>}

        {/* Pagination */}
        {(() => {
          const totalPages = Math.ceil(total / SESSIONS_PER_PAGE);
          if (totalPages <= 1) return null;
          return (
            <div className="flex items-center justify-between pt-4">
              <span className="text-xs text-text-secondary">{total} сессий</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-alt disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-text-secondary">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-alt disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
