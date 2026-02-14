"use client";

import { useState, useEffect } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

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

export default function AdminPromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState({ code: "", description: "", discount: 10, maxUses: 0, validUntil: "" });

  const fetchCodes = async () => {
    const res = await fetch("/api/admin/promo-codes");
    setCodes(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchCodes(); }, []);

  const handleCreate = async () => {
    const res = await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCode),
    });
    if (res.ok) {
      setAdding(false);
      setNewCode({ code: "", description: "", discount: 10, maxUses: 0, validUntil: "" });
      fetchCodes();
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/admin/promo-codes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchCodes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить промокод?")) return;
    await fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
    fetchCodes();
  };

  if (loading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-16" />)}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Промокоды</h1>
          <p className="text-sm text-text-muted mt-1">Скидки и промо-акции</p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => setAdding(!adding)}>
          <Plus className="h-4 w-4" /> Создать
        </Button>
      </div>

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
                  {c.maxUses > 0 && <span className="text-xs text-text-muted">{c.usedCount}/{c.maxUses}</span>}
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  {c.description || "Без описания"}
                  {c.validUntil && <> &middot; до {new Date(c.validUntil).toLocaleDateString("ru-RU")}</>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="secondary" size="sm" onClick={() => handleToggle(c.id, c.isActive)}>
                {c.isActive ? "Откл." : "Вкл."}
              </Button>
              <button onClick={() => handleDelete(c.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {codes.length === 0 && <p className="text-sm text-text-muted text-center py-8">Промокоды не созданы</p>}
      </div>
    </div>
  );
}
