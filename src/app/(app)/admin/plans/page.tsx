"use client";

import { useState, useEffect } from "react";
import { PlanForm } from "@/components/admin/PlanForm";

interface PlanData {
  id: string;
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
  isDefault: boolean;
  highlighted: boolean;
  _count?: { subscriptions: number };
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlans = async () => {
    const res = await fetch("/api/admin/plans");
    const data = await res.json();
    setPlans(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleSave = async (id: string, data: Partial<PlanData>) => {
    await fetch(`/api/admin/plans/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    fetchPlans();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-48"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        Управление тарифами
      </h2>
      <div className="space-y-4">
        {plans.map((plan) => (
          <PlanForm key={plan.id} plan={plan} onSave={handleSave} />
        ))}
      </div>
    </div>
  );
}
