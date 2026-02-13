"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { UserEditModal } from "./UserEditModal";

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  createdAt: string;
  subscription: {
    plan: { slug: string; name: string };
    expiresAt: string | null;
  } | null;
}

interface Plan {
  slug: string;
  name: string;
}

export function UsersTable() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      ...(search && { search }),
    });
    const res = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setUsers(data.users);
    setTotal(data.total);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetch("/api/admin/plans")
      .then((r) => r.json())
      .then((data) =>
        setPlans(data.map((p: Plan & { id: string }) => ({ slug: p.slug, name: p.name })))
      );
  }, []);

  const totalPages = Math.ceil(total / 20);

  const handleSave = async (userId: string, role: string, planSlug: string) => {
    await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, planSlug }),
    });
    setEditUser(null);
    fetchUsers();
  };

  const roleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <Badge variant="error">Админ</Badge>;
      case "PRO":
        return <Badge variant="accent">Pro</Badge>;
      default:
        return <Badge variant="default">Юзер</Badge>;
    }
  };

  return (
    <div>
      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          type="text"
          placeholder="Поиск по имени или email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              <th className="text-left text-xs font-medium text-text-muted px-4 py-3">
                Пользователь
              </th>
              <th className="text-left text-xs font-medium text-text-muted px-4 py-3">
                Роль
              </th>
              <th className="text-left text-xs font-medium text-text-muted px-4 py-3">
                Тариф
              </th>
              <th className="text-left text-xs font-medium text-text-muted px-4 py-3">
                Дата регистрации
              </th>
              <th className="text-right text-xs font-medium text-text-muted px-4 py-3">
                Действия
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-text-muted text-sm">
                  Загрузка...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-text-muted text-sm">
                  Пользователи не найдены
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-border last:border-0 hover:bg-surface-alt transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {user.name || "—"}
                      </p>
                      <p className="text-xs text-text-muted">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">{roleBadge(user.role)}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-text-secondary">
                      {user.subscription?.plan.name || "Free"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-text-secondary">
                      {new Date(user.createdAt).toLocaleDateString("ru-RU")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditUser(user)}
                      className="text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
                    >
                      Редактировать
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-text-muted">
            {total} пользователей
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-alt disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-text-secondary">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-alt disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <UserEditModal
          user={editUser}
          plans={plans}
          onSave={handleSave}
          onClose={() => setEditUser(null)}
        />
      )}
    </div>
  );
}
