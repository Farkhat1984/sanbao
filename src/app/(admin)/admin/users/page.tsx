import { UsersTable } from "@/components/admin/UsersTable";

export default function AdminUsersPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)] mb-4">
        Пользователи
      </h1>
      <UsersTable />
    </div>
  );
}
