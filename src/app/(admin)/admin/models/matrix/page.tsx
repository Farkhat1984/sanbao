"use client";

import { useState, useEffect } from "react";
import { Check, Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

interface Plan { id: string; name: string; slug: string }
interface Model { id: string; displayName: string; category: string; provider: { name: string } }
interface PlanModel { id: string; planId: string; modelId: string; isDefault: boolean }

const CATEGORY_LABELS: Record<string, string> = {
  TEXT: "Текст", IMAGE: "Изображения", VOICE: "Голос", VIDEO: "Видео", CODE: "Код", EMBEDDING: "Эмбеддинги",
};

export default function ModelMatrixPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [planModels, setPlanModels] = useState<PlanModel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const res = await fetch("/api/admin/plan-models");
    const data = await res.json();
    setPlans(data.plans || []);
    setModels(data.models || []);
    setPlanModels(data.planModels || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const isLinked = (planId: string, modelId: string) =>
    planModels.some((pm) => pm.planId === planId && pm.modelId === modelId);

  const isDefault = (planId: string, modelId: string) =>
    planModels.some((pm) => pm.planId === planId && pm.modelId === modelId && pm.isDefault);

  const handleToggle = async (planId: string, modelId: string) => {
    const linked = isLinked(planId, modelId);
    await fetch("/api/admin/plan-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, modelId, action: linked ? "remove" : "add" }),
    });
    fetchData();
  };

  const handleSetDefault = async (planId: string, modelId: string) => {
    await fetch("/api/admin/plan-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, modelId, action: "setDefault" }),
    });
    fetchData();
  };

  // Group models by category
  const categories = [...new Set(models.map((m) => m.category))];

  if (loading) {
    return <div className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-64" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Матрица моделей</h1>
          <p className="text-sm text-text-muted mt-1">Доступность моделей по тарифам</p>
        </div>
        <Link href="/admin/models" className="text-sm text-accent hover:underline">&larr; К списку моделей</Link>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-text-muted font-medium sticky left-0 bg-surface z-10">Модель</th>
              {plans.map((plan) => (
                <th key={plan.id} className="px-4 py-3 text-center text-text-primary font-medium min-w-[100px]">
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <>
                <tr key={`cat-${cat}`}>
                  <td colSpan={plans.length + 1} className="px-4 py-2 bg-surface-alt">
                    <Badge variant="default">{CATEGORY_LABELS[cat] || cat}</Badge>
                  </td>
                </tr>
                {models
                  .filter((m) => m.category === cat)
                  .map((model) => (
                    <tr key={model.id} className="border-b border-border/50 hover:bg-surface-alt/50 transition-colors">
                      <td className="px-4 py-2.5 sticky left-0 bg-surface z-10">
                        <div className="text-text-primary font-medium">{model.displayName}</div>
                        <div className="text-xs text-text-muted">{model.provider.name}</div>
                      </td>
                      {plans.map((plan) => {
                        const linked = isLinked(plan.id, model.id);
                        const def = isDefault(plan.id, model.id);
                        return (
                          <td key={plan.id} className="px-4 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleToggle(plan.id, model.id)}
                                className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                                  linked
                                    ? "bg-accent/15 text-accent hover:bg-accent/25"
                                    : "bg-surface-alt text-text-muted hover:bg-surface-alt/80"
                                }`}
                              >
                                {linked && <Check className="h-3.5 w-3.5" />}
                              </button>
                              {linked && (
                                <button
                                  onClick={() => handleSetDefault(plan.id, model.id)}
                                  className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                                    def
                                      ? "bg-warning/15 text-warning"
                                      : "text-text-muted hover:text-warning hover:bg-warning/10"
                                  }`}
                                  title="По умолчанию для этого плана"
                                >
                                  <Star className={`h-3 w-3 ${def ? "fill-current" : ""}`} />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-text-muted">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded bg-accent/15 flex items-center justify-center"><Check className="h-3 w-3 text-accent" /></div>
          Доступна
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded bg-warning/15 flex items-center justify-center"><Star className="h-3 w-3 text-warning fill-current" /></div>
          По умолчанию
        </div>
      </div>
    </div>
  );
}
