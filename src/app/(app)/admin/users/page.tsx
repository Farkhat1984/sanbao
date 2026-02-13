"use client";

import { UsersTable } from "@/components/admin/UsersTable";

export default function AdminUsersPage() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        Пользователи
      </h2>
      <UsersTable />
    </div>
  );
}
