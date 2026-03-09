"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LogOut } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminListSkeleton } from "@/components/admin/AdminListSkeleton";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { useAdminList } from "@/hooks/useAdminList";

interface SessionEntry {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  expires: string;
  createdAt?: string;
}

const SESSIONS_PER_PAGE = 50;

export default function AdminSessionsPage() {
  const { items: sessions, loading, page, total, totalPages, setPage, refetch } =
    useAdminList<SessionEntry>({
      endpoint: "/api/admin/sessions",
      perPage: SESSIONS_PER_PAGE,
      dataKey: "sessions",
    });

  const handleRevoke = async (id: string) => {
    if (!confirm("Завершить сессию пользователя?")) return;
    await fetch(`/api/admin/sessions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: id }),
    });
    refetch();
  };

  const handleRevokeAll = async () => {
    if (!confirm("Завершить ВСЕ сессии? Пользователям придётся войти заново.")) return;
    await fetch(`/api/admin/sessions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    refetch();
  };

  const isExpired = (expires: string) => new Date(expires) < new Date();

  if (loading) return <AdminListSkeleton rows={5} height="h-16" />;

  return (
    <div>
      <AdminPageHeader
        title="Сессии"
        subtitle="Активные сессии пользователей"
        count={total}
        action={
          <Button variant="secondary" size="sm" onClick={handleRevokeAll}>
            <LogOut className="h-4 w-4" /> Завершить все
          </Button>
        }
      />

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
        {sessions.length === 0 && <AdminEmptyState message="Нет активных сессий" />}

        <AdminPagination
          page={page}
          totalPages={totalPages}
          total={total}
          label="сессий"
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
