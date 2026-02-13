"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { UsageBar } from "@/components/billing/UsageBar";
import { PlanCard } from "@/components/billing/PlanCard";
import {
  Sun,
  Moon,
  Monitor,
  Globe,
  Bell,
  LogOut,
  Sparkles,
  User,
  CreditCard,
  BarChart3,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanInfo {
  slug: string;
  name: string;
  description: string | null;
  price: string;
  messagesPerDay: number;
  tokensPerMessage: number;
  requestsPerMinute: number;
  contextWindowSize: number;
  maxConversations: number;
  canUseAdvancedTools: boolean;
  canChooseProvider: boolean;
  highlighted?: boolean;
}

interface BillingData {
  plan: PlanInfo | null;
  usage: { messageCount: number; tokenCount: number };
  subscription: { grantedAt: string; expiresAt: string | null } | null;
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [loadingBilling, setLoadingBilling] = useState(true);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/current").then((r) => r.json()),
      fetch("/api/billing/plans").then((r) => r.json()),
    ]).then(([billingData, plansData]) => {
      setBilling(billingData);
      setPlans(plansData);
      setLoadingBilling(false);
    });
  }, []);

  const themes = [
    { key: "light", label: "Светлая", icon: Sun },
    { key: "dark", label: "Тёмная", icon: Moon },
    { key: "system", label: "Системная", icon: Monitor },
  ] as const;

  const currentPlan = billing?.plan;
  const usage = billing?.usage;

  return (
    <div className="h-full">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">
        <h1 className="text-xl font-bold text-text-primary">Настройки</h1>

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
                  label="Токены за сегодня"
                  current={usage?.tokenCount || 0}
                  max={
                    (currentPlan?.tokensPerMessage || 4096) *
                    (currentPlan?.messagesPerDay || 20) || 0
                  }
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

        {/* Theme */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sun className="h-4 w-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Тема</h2>
          </div>
          <div className="flex gap-2">
            {themes.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTheme(key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer",
                  mounted && theme === key
                    ? "bg-accent-light text-accent border border-accent/20"
                    : "bg-surface-alt text-text-secondary border border-border hover:border-border-hover"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Language */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Язык</h2>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-alt border border-border">
            <Globe className="h-4 w-4 text-text-muted" />
            <span className="text-sm text-text-primary">Русский</span>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Уведомления</h2>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface-alt border border-border">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-text-muted" />
              <span className="text-sm text-text-primary">Email-уведомления</span>
            </div>
            <button className="w-10 h-6 rounded-full bg-accent relative cursor-pointer transition-colors">
              <div className="w-4 h-4 rounded-full bg-white absolute right-1 top-1 transition-all" />
            </button>
          </div>
        </section>

        {/* Privacy */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Конфиденциальность</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-alt border border-border">
              <span className="text-sm text-text-primary">Сохранять историю чатов</span>
              <button className="w-10 h-6 rounded-full bg-accent relative cursor-pointer transition-colors">
                <div className="w-4 h-4 rounded-full bg-white absolute right-1 top-1 transition-all" />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-alt border border-border">
              <span className="text-sm text-text-primary">Использовать данные для улучшения</span>
              <button className="w-10 h-6 rounded-full bg-border relative cursor-pointer transition-colors">
                <div className="w-4 h-4 rounded-full bg-white absolute left-1 top-1 transition-all" />
              </button>
            </div>
          </div>
        </section>

        {/* Logout */}
        <section className="pt-4 border-t border-border pb-8">
          <Button
            variant="ghost"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-error hover:text-error hover:bg-red-50 dark:hover:bg-red-950"
          >
            <LogOut className="h-4 w-4" />
            Выйти из аккаунта
          </Button>
        </section>
      </div>
    </div>
  );
}
