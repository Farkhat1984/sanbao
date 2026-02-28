"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { resetAllStores } from "@/stores/resetStores";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { UsageBar } from "@/components/billing/UsageBar";
import { PlanCard } from "@/components/billing/PlanCard";
import {
  LogOut,
  Sparkles,
  User,
  CreditCard,
  BarChart3,
  Brain,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MemoryManager } from "@/components/memory/MemoryManager";

interface PlanInfo {
  slug: string;
  name: string;
  description: string | null;
  price: string;
  messagesPerDay: number;
  tokensPerMessage: number;
  tokensPerMonth: number;
  requestsPerMinute: number;
  contextWindowSize: number;
  maxConversations: number;
  maxAgents: number;
  documentsPerMonth: number;
  canUseAdvancedTools: boolean;
  canUseReasoning: boolean;
  canUseRag: boolean;
  canUseGraph: boolean;
  canChooseProvider: boolean;
  highlighted?: boolean;
}

interface BillingData {
  plan: PlanInfo | null;
  usage: { messageCount: number; tokenCount: number };
  monthlyUsage: { tokenCount: number; messageCount: number };
  subscription: { grantedAt: string; expiresAt: string | null } | null;
}

function TwoFactorSection({ isAdmin, autoSetup }: { isAdmin?: boolean; autoSetup?: boolean }) {
  const [twoFa, setTwoFa] = useState<{ enabled: boolean; qrCodeUrl?: string; secret?: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [loading2fa, setLoading2fa] = useState(false);

  useEffect(() => {
    fetch("/api/auth/2fa").then((r) => r.json()).then((data) => {
      setTwoFa(data);
      if (autoSetup && !data.enabled && !data.qrCodeUrl) {
        fetch("/api/auth/2fa").then((r) => r.json()).then(setTwoFa);
      }
    });
  }, [autoSetup]);

  const handleSetup = async () => {
    const res = await fetch("/api/auth/2fa");
    const data = await res.json();
    setTwoFa(data);
  };

  const handleEnable = async () => {
    if (!code) return;
    setLoading2fa(true);
    const res = await fetch("/api/auth/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, action: "enable" }),
    });
    const data = await res.json();
    if (data.success) {
      setTwoFa({ enabled: true });
      setMsg("2FA включена");
      setCode("");
    } else {
      setMsg(data.error || "Ошибка");
    }
    setLoading2fa(false);
  };

  const handleDisable = async () => {
    if (!code) return;
    setLoading2fa(true);
    const res = await fetch("/api/auth/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, action: "disable" }),
    });
    const data = await res.json();
    if (data.success) {
      setTwoFa({ enabled: false });
      setMsg("2FA отключена");
      setCode("");
    } else {
      setMsg(data.error || "Ошибка");
    }
    setLoading2fa(false);
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Lock className="h-4 w-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text-primary">Двухфакторная аутентификация</h2>
      </div>
      <div className="p-4 rounded-xl bg-surface-alt border border-border space-y-3">
        {twoFa?.enabled ? (
          <>
            <p className="text-sm text-success">2FA включена</p>
            {!isAdmin && (
              <div className="flex gap-2">
                <input placeholder="Код из приложения" value={code} onChange={(e) => setCode(e.target.value)} className="h-9 px-3 rounded-lg bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent w-40 font-mono" />
                <Button variant="secondary" size="sm" onClick={handleDisable} isLoading={loading2fa}>Отключить</Button>
              </div>
            )}
            {isAdmin && <p className="text-xs text-text-muted">Для администраторов 2FA обязательна и не может быть отключена</p>}
          </>
        ) : twoFa?.qrCodeUrl ? (
          <>
            <p className="text-sm text-text-primary">Отсканируйте QR-код в Google Authenticator:</p>
            <img src={twoFa.qrCodeUrl} alt="QR Code" className="w-48 h-48 rounded-lg" />
            <p className="text-xs text-text-muted font-mono break-all">Секрет: {twoFa.secret}</p>
            <div className="flex gap-2">
              <input placeholder="6-значный код" value={code} onChange={(e) => setCode(e.target.value)} className="h-9 px-3 rounded-lg bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent w-40 font-mono" />
              <Button variant="gradient" size="sm" onClick={handleEnable} isLoading={loading2fa}>Подтвердить</Button>
            </div>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={handleSetup}>Настроить 2FA</Button>
        )}
        {msg && <p className="text-xs text-text-muted">{msg}</p>}
      </div>
    </section>
  );
}

function SettingsContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const setup2fa = searchParams.get("setup2fa") === "1";
  const isAdmin = session?.user?.role === "ADMIN";
  const [mounted, setMounted] = useState(false);
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [loadingBilling, setLoadingBilling] = useState(true);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/current").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/billing/plans").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([billingData, plansData]) => {
        if (billingData) setBilling(billingData);
        if (Array.isArray(plansData)) setPlans(plansData);
        setLoadingBilling(false);
      })
      .catch(() => setLoadingBilling(false));
  }, []);

  const currentPlan = billing?.plan;
  const usage = billing?.usage;
  const monthlyUsage = billing?.monthlyUsage;

  return (
    <div className="h-full">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        <h1 className="text-xl font-bold text-text-primary">Настройки</h1>

        {setup2fa && !mounted ? null : setup2fa && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-sm font-medium text-amber-800">
              Для доступа к админ-панели необходимо включить двухфакторную аутентификацию (2FA).
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Настройте 2FA ниже, затем вернитесь в админ-панель.
            </p>
          </div>
        )}

        {/* Profile */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Профиль</h2>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center gap-4">
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt=""
                  className="h-12 w-12 rounded-xl object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-accent-light flex items-center justify-center">
                  <User className="h-6 w-6 text-accent" />
                </div>
              )}
              <div>
                <p className="text-base font-semibold text-text-primary">
                  {session?.user?.name || "Пользователь"}
                </p>
                <p className="text-sm text-text-muted">
                  {session?.user?.email}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Usage */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Использование</h2>
          </div>
          {loadingBilling ? (
            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-surface-alt rounded w-40" />
                <div className="h-2 bg-surface-alt rounded" />
                <div className="h-4 bg-surface-alt rounded w-32" />
                <div className="h-2 bg-surface-alt rounded" />
              </div>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-2xl p-5">
              {currentPlan && (
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm text-text-secondary">Текущий тариф:</span>
                  <Badge variant="accent">
                    <Sparkles className="h-3 w-3" />
                    {currentPlan.name}
                  </Badge>
                </div>
              )}
              <div className="space-y-3">
                <UsageBar
                  label="Сообщения за сегодня"
                  current={usage?.messageCount || 0}
                  max={currentPlan?.messagesPerDay || 20}
                />
                <UsageBar
                  label="Токены за месяц"
                  current={monthlyUsage?.tokenCount || 0}
                  max={currentPlan?.tokensPerMonth || 100000}
                  color="bg-legal-ref"
                />
              </div>
            </div>
          )}
        </section>

        {/* Billing / Plans */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="h-4 w-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Тарифы</h2>
          </div>
          {loadingBilling ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-72 bg-surface-alt rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.slug}
                  plan={plan}
                  isCurrent={currentPlan?.slug === plan.slug}
                />
              ))}
            </div>
          )}
        </section>

        {/* Memory */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-4 w-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Память</h2>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-5">
            <p className="text-xs text-text-muted mb-3">
              AI запоминает ваши предпочтения и использует их в каждом разговоре.
            </p>
            <MemoryManager />
          </div>
        </section>

        {/* 2FA */}
        <TwoFactorSection isAdmin={isAdmin} autoSetup={setup2fa} />

        {/* Logout */}
        <section className="pt-4 border-t border-border pb-8">
          <Button
            variant="ghost"
            onClick={() => { resetAllStores(); signOut({ callbackUrl: "/login" }); }}
            className="text-error hover:text-error hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Выйти из аккаунта
          </Button>
        </section>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
