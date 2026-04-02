"use client";

import Link from "next/link";
import { AgentForm } from "@sanbao/ui/components/agents/AgentForm";
import { useBillingStore } from "@/stores/billingStore";
import { AlertTriangle } from "lucide-react";

export default function NewAgentPage() {
  const canUseRag = useBillingStore((s) => s.plan?.canUseRag ?? false);
  const canUseAgents = useBillingStore((s) => s.plan?.canUseAgents ?? false);

  if (!canUseAgents) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="max-w-md text-center space-y-4 p-6">
          <AlertTriangle className="h-12 w-12 text-warning mx-auto" />
          <h2 className="text-lg font-bold text-text-primary">
            Создание агентов недоступно на вашем тарифе
          </h2>
          <p className="text-sm text-text-secondary">
            Перейдите на более высокий тариф для доступа к созданию агентов.
          </p>
          <Link
            href="/settings"
            className="inline-flex h-10 px-6 items-center justify-center rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            Перейти к тарифам
          </Link>
        </div>
      </div>
    );
  }

  return <AgentForm canUseRag={canUseRag} />;
}
