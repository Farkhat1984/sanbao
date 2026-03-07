"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CreditCard, DollarSign, TrendingUp, Users, RotateCcw, UserPlus, XCircle, ChevronLeft, ChevronRight } from "lucide-react";

interface BillingStats {
  totalSubscriptions: number;
  planDistribution: { planName: string; count: number }[];
  subscriptions: { userId: string; userName: string; planId: string; planName: string; amount: number; expiresAt: string | null; grantedBy: string | null; createdAt: string }[];
  subPage: number;
  subLimit: number;
  payments: { id: string; userId: string; userName: string; amount: number; currency: string; status: string; provider: string; createdAt: string }[];
  totalPayments: number;
  payPage: number;
  payLimit: number;
  monthlyRevenue: number;
  plans?: { id: string; name: string; price: number }[];
}

const SUBS_PER_PAGE = 25;
const PAYMENTS_PER_PAGE = 25;

export default function AdminBillingPage() {
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignPlanId, setAssignPlanId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [subPage, setSubPage] = useState(1);
  const [payPage, setPayPage] = useState(1);

  const fetchBilling = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      subPage: String(subPage),
      subLimit: String(SUBS_PER_PAGE),
      payPage: String(payPage),
      payLimit: String(PAYMENTS_PER_PAGE),
    });
    const res = await fetch(`/api/admin/billing?${params}`);
    const data = await res.json();
    setStats(data);
    setLoading(false);
  }, [subPage, payPage]);

  useEffect(() => { fetchBilling(); }, [fetchBilling]);

  const handleRefund = async (userId: string) => {
    if (!confirm("Возврат средств и понижение до бесплатного тарифа?")) return;
    setRefunding(userId);
    await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "refund" }),
    });
    setRefunding(null);
    fetchBilling();
  };

  const handleAssign = async () => {
    if (!assignUserId || !assignPlanId) return;
    setAssigning(true);
    await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: assignUserId, planId: assignPlanId, action: "assign" }),
    });
    setAssigning(false);
    setAssignUserId("");
    setAssignPlanId("");
    fetchBilling();
  };

  const handleCancel = async (userId: string) => {
    if (!confirm("Отменить подписку и понизить до бесплатного плана?")) return;
    await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "cancel" }),
    });
    fetchBilling();
  };

  if (loading || !stats) {
    return <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-24" />)}</div>;
  }

  const subTotalPages = Math.ceil(stats.totalSubscriptions / SUBS_PER_PAGE);
  const payTotalPages = Math.ceil(stats.totalPayments / PAYMENTS_PER_PAGE);

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)] mb-1">Биллинг</h1>
      <p className="text-sm text-text-secondary mb-6">Подписки и платежи</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-text-secondary" />
            <p className="text-xs text-text-secondary">Подписки</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">{stats.totalSubscriptions}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-text-secondary" />
            <p className="text-xs text-text-secondary">MRR (расчётный)</p>
          </div>
          <p className="text-2xl font-bold text-accent">{stats.monthlyRevenue.toLocaleString()} &#x20B8;</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-text-secondary" />
            <p className="text-xs text-text-secondary">Платежей</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">{stats.totalPayments}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-text-secondary" />
            <p className="text-xs text-text-secondary">Планов</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">{stats.planDistribution.length}</p>
        </div>
      </div>

      {/* Plan distribution */}
      <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Распределение по планам</h2>
        <div className="space-y-3">
          {stats.planDistribution.map((p) => {
            const pct = stats.totalSubscriptions > 0 ? Math.round((p.count / stats.totalSubscriptions) * 100) : 0;
            return (
              <div key={p.planName} className="flex items-center gap-3">
                <span className="text-sm text-text-primary w-24">{p.planName}</span>
                <div className="flex-1 bg-surface-alt rounded-full h-5 overflow-hidden">
                  <div className="bg-accent/60 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm text-text-secondary w-16 text-right">{p.count} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Manual subscription management */}
      <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Назначить подписку</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs text-text-secondary block mb-1">User ID</label>
            <input placeholder="clu..." value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="w-full h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-text-secondary block mb-1">План</label>
            <select value={assignPlanId} onChange={(e) => setAssignPlanId(e.target.value)} className="w-full h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent">
              <option value="">Выберите план</option>
              {stats.plans?.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.price})</option>)}
            </select>
          </div>
          <Button variant="gradient" size="sm" onClick={handleAssign} isLoading={assigning}>
            <UserPlus className="h-3.5 w-3.5" /> Назначить
          </Button>
        </div>
      </div>

      {/* Subscriptions with pagination */}
      <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Подписки ({stats.totalSubscriptions})</h2>
        <div className="space-y-2">
          {stats.subscriptions.map((s) => (
            <div key={s.userId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <span className="text-sm text-text-primary">{s.userName}</span>
                <Badge variant="default" className="ml-2">{s.planName}</Badge>
                {s.grantedBy && <span className="text-xs text-text-secondary ml-2">(назначено вручную)</span>}
                {s.expiresAt && <span className="text-xs text-text-secondary ml-2">до {new Date(s.expiresAt).toLocaleDateString("ru-RU")}</span>}
                <span className="text-xs text-text-secondary ml-2">&middot; {new Date(s.createdAt).toLocaleDateString("ru-RU")}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRefund(s.userId)}
                  isLoading={refunding === s.userId}
                >
                  <RotateCcw className="h-3 w-3" /> Возврат
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleCancel(s.userId)}>
                  <XCircle className="h-3 w-3" /> Отмена
                </Button>
              </div>
            </div>
          ))}
          {stats.subscriptions.length === 0 && <p className="text-sm text-text-secondary text-center py-4">Нет подписок</p>}
        </div>

        {/* Subscriptions pagination */}
        {subTotalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <span className="text-xs text-text-secondary">{stats.totalSubscriptions} подписок</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSubPage((p) => Math.max(1, p - 1))}
                disabled={subPage === 1}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-alt disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-text-secondary">{subPage} / {subTotalPages}</span>
              <button
                onClick={() => setSubPage((p) => Math.min(subTotalPages, p + 1))}
                disabled={subPage === subTotalPages}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-alt disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment history with pagination */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Платежи ({stats.totalPayments})</h2>
        <div className="space-y-2">
          {stats.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <span className="text-sm text-text-primary">{p.userName}</span>
                <span className="text-xs text-text-secondary ml-2">&middot; {new Date(p.createdAt).toLocaleDateString("ru-RU")}</span>
                <span className="text-xs text-text-secondary ml-2">&middot; {p.provider}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={p.status === "COMPLETED" ? "accent" : p.status === "REFUNDED" ? "default" : "default"}>
                  {p.status === "COMPLETED" ? "Оплачен" : p.status === "REFUNDED" ? "Возврат" : p.status === "FAILED" ? "Ошибка" : "Ожидание"}
                </Badge>
                <span className="text-sm font-medium text-text-primary">{(p.amount / 100).toLocaleString()} {p.currency}</span>
                {p.status === "COMPLETED" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRefund(p.userId)}
                    isLoading={refunding === p.userId}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {stats.payments.length === 0 && <p className="text-sm text-text-secondary text-center py-4">Нет платежей</p>}
        </div>

        {/* Payments pagination */}
        {payTotalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <span className="text-xs text-text-secondary">{stats.totalPayments} платежей</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPayPage((p) => Math.max(1, p - 1))}
                disabled={payPage === 1}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-alt disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-text-secondary">{payPage} / {payTotalPages}</span>
              <button
                onClick={() => setPayPage((p) => Math.min(payTotalPages, p + 1))}
                disabled={payPage === payTotalPages}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-alt disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
