"use client";

import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminListSkeleton } from "@/components/admin/AdminListSkeleton";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { useAdminList } from "@/hooks/useAdminList";

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discount: number;
  maxUses: number;
  usedCount: number;
  validUntil: string | null;
  isActive: boolean;
  createdAt: string;
}

const CODES_PER_PAGE = 30;

export default function AdminPromoCodesPage() {
  const { items: codes, loading, page, total, totalPages, setPage, refetch } =
    useAdminList<PromoCode>({
      endpoint: "/api/admin/promo-codes",
      perPage: CODES_PER_PAGE,
      dataKey: "codes",
    });

  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState({ code: "", description: "", discount: 10, maxUses: 0, validUntil: "" });

  const handleCreate = async () => {
    const res = await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCode),
    });
    if (res.ok) {
      setAdding(false);
      setNewCode({ code: "", description: "", discount: 10, maxUses: 0, validUntil: "" });
      refetch();
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/admin/promo-codes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить промокод?")) return;
    await fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
    refetch();
  };

  if (loading) return <AdminListSkeleton rows={3} height="h-16" />;

  return (
    <div>
      <AdminPageHeader
        title="Промокоды"
        subtitle="Скидки и промо-акции"
        count={total}
        action={
          <Button variant="gradient" size="sm" onClick={() => setAdding(!adding)}>
            <Plus className="h-4 w-4" /> Создать
          </Button>
        }
      />

      {adding && (
        <div className="bg-surface border border-accent/30 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Новый промокод</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Код (SUMMER2024)" value={newCode.code} onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent font-mono" />
            <input placeholder="Описание" value={newCode.description} onChange={(e) => setNewCode({ ...newCode, description: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <input placeholder="Скидка %" type="number" min="1" max="100" value={newCode.discount} onChange={(e) => setNewCode({ ...newCode, discount: parseInt(e.target.value) || 0 })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" />
            <input placeholder="Макс. использований (0=безлим)" type="number" value={newCode.maxUses} onChange={(e) => setNewCode({ ...newCode, maxUses: parseInt(e.target.value) || 0 })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" />
          </div>
          <div className="mt-3">
            <Button variant="gradient" size="sm" onClick={handleCreate}><Save className="h-3.5 w-3.5" /> Создать</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {codes.map((c) => (
          <div key={c.id} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${c.isActive ? "bg-success" : "bg-text-muted"}`} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-accent font-mono">{c.code}</span>
                  <Badge variant="default">-{c.discount}%</Badge>
                  {c.maxUses > 0 && <span className="text-xs text-text-secondary">{c.usedCount}/{c.maxUses}</span>}
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  {c.description || "Без описания"}
                  {c.validUntil && <> &middot; до {new Date(c.validUntil).toLocaleDateString("ru-RU")}</>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="secondary" size="sm" onClick={() => handleToggle(c.id, c.isActive)}>
                {c.isActive ? "Откл." : "Вкл."}
              </Button>
              <button onClick={() => handleDelete(c.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-error hover:bg-error/10 transition-colors cursor-pointer">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {codes.length === 0 && <AdminEmptyState message="Промокоды не созданы" />}

        <AdminPagination
          page={page}
          totalPages={totalPages}
          total={total}
          label="промокодов"
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
