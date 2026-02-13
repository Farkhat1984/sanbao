"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/Badge";
import { Sparkles } from "lucide-react";
import { PlanCard } from "@/components/billing/PlanCard";
import { UsageBar } from "@/components/billing/UsageBar";

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
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/current").then((r) => r.json()),
      fetch("/api/billing/plans").then((r) => r.json()),
    ]).then(([billingData, plansData]) => {
      setBilling(billingData);
      setPlans(plansData);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-surface-alt rounded-xl w-48" />
            <div className="h-32 bg-surface-alt rounded-2xl" />
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-80 bg-surface-alt rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentPlan = billing?.plan;
  const usage = billing?.usage;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-text-primary mb-6">
          Тарифы и использование
        </h1>

        {/* Current plan + usage */}
        {currentPlan && (
          <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-semibold text-text-primary">
                Текущий тариф
              </h2>
              <Badge variant="accent">
                <Sparkles className="h-3 w-3" />
                {currentPlan.name}
              </Badge>
            </div>

            <div className="space-y-3">
              <UsageBar
                label="Сообщения за сегодня"
                current={usage?.messageCount || 0}
                max={currentPlan.messagesPerDay}
              />
              <UsageBar
                label="Токены за сегодня"
                current={usage?.tokenCount || 0}
                max={currentPlan.tokensPerMessage * currentPlan.messagesPerDay || 0}
                color="bg-legal-ref"
              />
            </div>
          </div>
        )}

        {/* Plans grid */}
        <h2 className="text-sm font-semibold text-text-primary mb-4">
          Доступные тарифы
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <PlanCard
              key={plan.slug}
              plan={plan}
              isCurrent={currentPlan?.slug === plan.slug}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
