"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Users,
  RotateCcw,
  UserPlus,
  XCircle,
  Search,
  Loader2,
  Copy,
  Check,
} from "lucide-react";

interface SubItem {
  userId: string;
  userName: string;
  userEmail: string;
  planId: string;
  planName: string;
  amount: number;
  expiresAt: string | null;
  grantedBy: string | null;
  createdAt: string;
}

interface PayItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  createdAt: string;
}

interface BillingStats {
  totalSubscriptions: number;
  planDistribution: { planName: string; count: number }[];
  subscriptions: SubItem[];
  hasMoreSubs: boolean;
  nextSubCursor: string | null;
  payments: PayItem[];
  totalPayments: number;
  hasMorePays: boolean;
  nextPayCursor: string | null;
  monthlyRevenue: number;
  plans?: { id: string; name: string; price: number }[];
}

const LIMIT = 25;

function CopyId({ id }: { id: string }) {
  const { copied, copy } = useCopyToClipboard(1500);
  const short = id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
  return (
    <button
      onClick={() => copy(id)}
      className="inline-flex items-center gap-1 text-[11px] font-mono text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
      title={id}
    >
      {short}
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export default function AdminBillingPage() {
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [subs, setSubs] = useState<SubItem[]>([]);
  const [pays, setPays] = useState<PayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoreSubs, setLoadingMoreSubs] = useState(false);
  const [loadingMorePays, setLoadingMorePays] = useState(false);
  const [subCursor, setSubCursor] = useState<string | null>(null);
  const [payCursor, setPayCursor] = useState<string | null>(null);
  const [hasMoreSubs, setHasMoreSubs] = useState(false);
  const [hasMorePays, setHasMorePays] = useState(false);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignPlanId, setAssignPlanId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchInitial = useCallback(async (q: string, pf: string) => {
    setLoading(true);
    const params = new URLSearchParams({ subLimit: String(LIMIT), payLimit: String(LIMIT) });
    if (q) params.set("search", q);
    if (pf) params.set("planFilter", pf);
    const res = await fetch(`/api/admin/billing?${params}`);
    const data: BillingStats = await res.json();
    setStats(data);
    setSubs(data.subscriptions);
    setPays(data.payments);
    setSubCursor(data.nextSubCursor);
    setPayCursor(data.nextPayCursor);
    setHasMoreSubs(data.hasMoreSubs);
    setHasMorePays(data.hasMorePays);
    setLoading(false);
  }, []);

  useEffect(() => { fetchInitial(search, planFilter); }, [fetchInitial, planFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchInitial(val, planFilter), 400);
  };

  // Infinite scroll — subscriptions
  const loadMoreSubs = useCallback(async () => {
    if (!subCursor || loadingMoreSubs) return;
    setLoadingMoreSubs(true);
    const params = new URLSearchParams({ subLimit: String(LIMIT), subCursor, payLimit: "0" });
    if (search) params.set("search", search);
    if (planFilter) params.set("planFilter", planFilter);
    const res = await fetch(`/api/admin/billing?${params}`);
    const data: BillingStats = await res.json();
    setSubs((prev) => [...prev, ...data.subscriptions]);
    setSubCursor(data.nextSubCursor);
    setHasMoreSubs(data.hasMoreSubs);
    setLoadingMoreSubs(false);
  }, [subCursor, loadingMoreSubs, search, planFilter]);

  // Infinite scroll — payments
  const loadMorePays = useCallback(async () => {
    if (!payCursor || loadingMorePays) return;
    setLoadingMorePays(true);
    const params = new URLSearchParams({ payLimit: String(LIMIT), payCursor, subLimit: "0" });
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/billing?${params}`);
    const data: BillingStats = await res.json();
    setPays((prev) => [...prev, ...data.payments]);
    setPayCursor(data.nextPayCursor);
    setHasMorePays(data.hasMorePays);
    setLoadingMorePays(false);
  }, [payCursor, loadingMorePays, search]);

  const subsEndRef = useInfiniteScroll({
    onLoadMore: loadMoreSubs,
    hasMore: hasMoreSubs,
    loading: loadingMoreSubs,
    rootMargin: "0px",
    threshold: 0.1,
  });

  const paysEndRef = useInfiniteScroll({
    onLoadMore: loadMorePays,
    hasMore: hasMorePays,
    loading: loadingMorePays,
    rootMargin: "0px",
    threshold: 0.1,
  });

  const handleRefund = async (userId: string) => {
    if (!confirm("Возврат средств и понижение до бесплатного тарифа?")) return;
    setRefunding(userId);
    await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "refund" }),
    });
    setRefunding(null);
    fetchInitial(search, planFilter);
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
    fetchInitial(search, planFilter);
  };

  const handleCancel = async (userId: string) => {
    if (!confirm("Отменить подписку и понизить до бесплатного плана?")) return;
    await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "cancel" }),
    });
    fetchInitial(search, planFilter);
  };

  if (loading || !stats) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-24" />
        ))}
      </div>
    );
  }

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
          <p className="text-2xl font-bold text-accent">${stats.monthlyRevenue.toLocaleString("en-US")}</p>
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
                  <div className="bg-accent/60 h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 1)}%` }} />
                </div>
                <span className="text-sm text-text-secondary w-16 text-right">{p.count} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Поиск по имени, email или ID..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
        >
          <option value="">Все планы</option>
          {stats.plans?.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Manual subscription management */}
      <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Назначить подписку</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs text-text-secondary block mb-1">User ID</label>
            <input
              placeholder="clu..."
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-text-secondary block mb-1">План</label>
            <select
              value={assignPlanId}
              onChange={(e) => setAssignPlanId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Выберите план</option>
              {stats.plans?.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (${p.price})</option>
              ))}
            </select>
          </div>
          <Button variant="gradient" size="sm" onClick={handleAssign} isLoading={assigning}>
            <UserPlus className="h-3.5 w-3.5" /> Назначить
          </Button>
        </div>
      </div>

      {/* Subscriptions — infinite scroll */}
      <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Подписки ({stats.totalSubscriptions})</h2>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {subs.map((s) => (
            <div key={s.userId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-text-primary">{s.userName}</span>
                  <Badge variant="default">{s.planName}</Badge>
                  {s.grantedBy && <span className="text-xs text-text-secondary">(вручную)</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <CopyId id={s.userId} />
                  {s.userEmail && <span className="text-[11px] text-text-muted">{s.userEmail}</span>}
                  {s.expiresAt && <span className="text-[11px] text-text-muted">до {new Date(s.expiresAt).toLocaleDateString("ru-RU")}</span>}
                  <span className="text-[11px] text-text-muted">{new Date(s.createdAt).toLocaleDateString("ru-RU")}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <Button variant="secondary" size="sm" onClick={() => handleRefund(s.userId)} isLoading={refunding === s.userId}>
                  <RotateCcw className="h-3 w-3" /> Возврат
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleCancel(s.userId)}>
                  <XCircle className="h-3 w-3" /> Отмена
                </Button>
              </div>
            </div>
          ))}
          {subs.length === 0 && <p className="text-sm text-text-secondary text-center py-4">Нет подписок</p>}
          {loadingMoreSubs && (
            <div className="flex justify-center py-3">
              <Loader2 className="h-5 w-5 text-text-secondary animate-spin" />
            </div>
          )}
          <div ref={subsEndRef} />
        </div>
      </div>

      {/* Payment history — infinite scroll */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Платежи ({stats.totalPayments})</h2>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {pays.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-text-primary">{p.userName}</span>
                  <Badge variant={p.status === "COMPLETED" ? "accent" : p.status === "REFUNDED" ? "default" : "default"}>
                    {p.status === "COMPLETED" ? "Оплачен" : p.status === "REFUNDED" ? "Возврат" : p.status === "FAILED" ? "Ошибка" : "Ожидание"}
                  </Badge>
                  <span className="text-xs text-text-secondary">{p.provider}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <CopyId id={p.userId} />
                  {p.userEmail && <span className="text-[11px] text-text-muted">{p.userEmail}</span>}
                  <span className="text-[11px] text-text-muted">{new Date(p.createdAt).toLocaleDateString("ru-RU")}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-sm font-medium text-text-primary">${p.amount.toLocaleString("en-US")}</span>
                {p.status === "COMPLETED" && (
                  <Button variant="secondary" size="sm" onClick={() => handleRefund(p.userId)} isLoading={refunding === p.userId}>
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {pays.length === 0 && <p className="text-sm text-text-secondary text-center py-4">Нет платежей</p>}
          {loadingMorePays && (
            <div className="flex justify-center py-3">
              <Loader2 className="h-5 w-5 text-text-secondary animate-spin" />
            </div>
          )}
          <div ref={paysEndRef} />
        </div>
      </div>
    </div>
  );
}
