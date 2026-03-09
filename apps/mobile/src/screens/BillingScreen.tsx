/**
 * Billing screen — current plan, usage stats, upgrade option.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Crown, Zap, MessageSquare, Check } from 'lucide-react'
import { api } from '@/lib/api-client'
import { cn } from '@sanbao/shared/utils'
import type { PlanInfo, UsageInfo } from '@/types'

interface BillingResponse {
  plan: PlanInfo;
  usage: UsageInfo;
  monthlyUsage: UsageInfo;
}

interface PlansResponse {
  plans: PlanInfo[];
}

export default function BillingScreen() {
  const navigate = useNavigate()
  const [billing, setBilling] = useState<BillingResponse | null>(null)
  const [plans, setPlans] = useState<PlanInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [billingData, plansData] = await Promise.all([
          api.get<BillingResponse>('/api/billing'),
          api.get<PlansResponse>('/api/billing/plans'),
        ])
        if (cancelled) return
        setBilling(billingData)
        setPlans(plansData.plans)
      } catch {
        /* Silently fail */
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header
        className={cn(
          'flex items-center gap-3 px-3 py-2.5',
          'border-b border-[var(--border)]',
          'bg-[var(--bg-secondary)]',
        )}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full active:bg-[var(--surface-hover)]"
          aria-label="Назад"
        >
          <ArrowLeft size={20} className="text-[var(--text-primary)]" />
        </button>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Подписка
        </h2>
      </header>

      <div className="scroll-container flex-1 px-4 py-4">
        {isLoading ? (
          <BillingSkeleton />
        ) : billing ? (
          <>
            {/* Current plan card */}
            <div
              className={cn(
                'mb-6 rounded-2xl',
                'border border-[var(--accent)]/30 bg-[var(--accent-muted)]',
                'px-5 py-5',
              )}
            >
              <div className="mb-3 flex items-center gap-2">
                <Crown size={18} className="text-[var(--accent)]" />
                <span className="text-sm font-semibold text-[var(--accent)]">
                  Текущий тариф
                </span>
              </div>
              <h3 className="mb-1 text-2xl font-bold text-[var(--text-primary)]">
                {billing.plan.name}
              </h3>
              {billing.plan.description && (
                <p className="text-sm text-[var(--text-secondary)]">
                  {billing.plan.description}
                </p>
              )}
            </div>

            {/* Usage stats */}
            <section className="mb-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Использование сегодня
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <UsageStat
                  icon={MessageSquare}
                  label="Сообщения"
                  value={billing.usage.messageCount}
                  max={billing.plan.messagesPerDay}
                />
                <UsageStat
                  icon={Zap}
                  label="Токены"
                  value={Math.round(billing.usage.tokenCount / 1000)}
                  max={Math.round(billing.plan.tokensPerMonth / 1000)}
                  suffix="K"
                />
              </div>
            </section>

            {/* Available plans */}
            {plans.length > 1 && (
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Все тарифы
                </h3>
                <div className="space-y-3">
                  {plans.map((plan) => (
                    <PlanCard
                      key={plan.slug}
                      plan={plan}
                      isCurrent={plan.slug === billing.plan.slug}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <CreditCardIcon />
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              Не удалось загрузить информацию
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Sub-components ──────────────────────────────────────── */

function UsageStat({
  icon: Icon,
  label,
  value,
  max,
  suffix = '',
}: {
  icon: typeof MessageSquare;
  label: string;
  value: number;
  max: number;
  suffix?: string;
}) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--border)]',
        'bg-[var(--bg-secondary)] px-4 py-3',
      )}
    >
      <Icon size={14} className="mb-2 text-[var(--text-muted)]" />
      <div className="mb-1 text-lg font-bold text-[var(--text-primary)]">
        {value}{suffix}
        <span className="text-xs font-normal text-[var(--text-muted)]">
          {' '}/ {max}{suffix}
        </span>
      </div>
      <p className="mb-2 text-[10px] text-[var(--text-muted)]">{label}</p>
      <div className="h-1 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            percent > 80 ? 'bg-[var(--warning)]' : 'bg-[var(--accent)]',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function PlanCard({
  plan,
  isCurrent,
}: {
  plan: PlanInfo;
  isCurrent: boolean;
}) {
  const features = [
    `${plan.messagesPerDay} сообщ./день`,
    plan.canUseReasoning && 'Рассуждения AI',
    plan.canUseAdvancedTools && 'Продвинутые инструменты',
    plan.canUseSkills && 'Навыки',
  ].filter(Boolean) as string[]

  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-4',
        isCurrent
          ? 'border-[var(--accent)]/50 bg-[var(--accent-muted)]'
          : 'border-[var(--border)] bg-[var(--bg-secondary)]',
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {plan.name}
        </span>
        <span className="text-sm font-bold text-[var(--accent)]">
          {plan.price === 0 ? 'Бесплатно' : `${plan.price.toLocaleString('ru-RU')} ₸/мес`}
        </span>
      </div>
      <ul className="space-y-1">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Check size={12} className="shrink-0 text-[var(--success)]" />
            {f}
          </li>
        ))}
      </ul>
      {isCurrent && (
        <span className="mt-2 inline-block rounded-md bg-[var(--accent)]/20 px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
          Текущий
        </span>
      )}
    </div>
  )
}

function CreditCardIcon() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--border)]">
      <Crown size={28} className="text-[var(--text-muted)]" />
    </div>
  )
}

function BillingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-32 animate-pulse rounded-2xl bg-[var(--border)]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 animate-pulse rounded-xl bg-[var(--border)]" />
        <div className="h-28 animate-pulse rounded-xl bg-[var(--border)]" />
      </div>
    </div>
  )
}
