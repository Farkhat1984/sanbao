"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface UserEditModalProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    subscription: {
      plan: { slug: string; name: string };
    } | null;
  };
  plans: { slug: string; name: string }[];
  onSave: (userId: string, role: string, planSlug: string) => void;
  onClose: () => void;
}

export function UserEditModal({
  user,
  plans,
  onSave,
  onClose,
}: UserEditModalProps) {
  const [role, setRole] = useState(user.role);
  const [planSlug, setPlanSlug] = useState(
    user.subscription?.plan.slug || "free"
  );

  return (
    <Modal isOpen onClose={onClose} title="Редактировать пользователя">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-text-primary">
            {user.name || "—"}
          </p>
          <p className="text-xs text-text-muted">{user.email}</p>
        </div>

        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1.5">
            Роль
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent transition-colors cursor-pointer"
          >
            <option value="USER">Пользователь</option>
            <option value="PRO">Pro</option>
            <option value="ADMIN">Администратор</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1.5">
            Тариф
          </label>
          <select
            value={planSlug}
            onChange={(e) => setPlanSlug(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent transition-colors cursor-pointer"
          >
            {plans.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="gradient"
            size="md"
            className="flex-1"
            onClick={() => onSave(user.id, role, planSlug)}
          >
            Сохранить
          </Button>
          <Button variant="secondary" size="md" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </div>
    </Modal>
  );
}
