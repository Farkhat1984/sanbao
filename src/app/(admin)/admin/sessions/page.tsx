"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LogOut } from "lucide-react";

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

  const fetchSessions = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/sessions");
    const data = await res.json();
    setSessions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchSessions(); }, []);

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
          <h1 className="text-xl font-bold text-text-primary">Сессии</h1>
          <p className="text-sm text-text-muted mt-1">Активные сессии пользователей ({sessions.length})</p>
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
                <p className="text-xs text-text-muted mt-0.5">
                  {s.userEmail} &middot; Истекает: {new Date(s.expires).toLocaleString("ru-RU")}
                </p>
              </div>
            </div>
            <button onClick={() => handleRevoke(s.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer" title="Завершить сессию">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {sessions.length === 0 && <p className="text-sm text-text-muted text-center py-8">Нет активных сессий</p>}
      </div>
    </div>
  );
}
