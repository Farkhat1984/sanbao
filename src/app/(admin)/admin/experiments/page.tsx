"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Power, PowerOff, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Experiment {
  id: string;
  name: string;
  description: string | null;
  key: string;
  isActive: boolean;
  trafficPct: number;
  variantA: string;
  variantB: string;
  impressionsA: number;
  impressionsB: number;
  avgRatingA: number;
  avgRatingB: number;
  createdAt: string;
}

export default function AdminExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    key: "global_system_prompt",
    variantA: "",
    variantB: "",
    trafficPct: 50,
  });

  const fetchData = async () => {
    const res = await fetch("/api/admin/experiments");
    setExperiments(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    const res = await fetch("/api/admin/experiments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setAdding(false);
      setForm({ name: "", description: "", key: "global_system_prompt", variantA: "", variantB: "", trafficPct: 50 });
      fetchData();
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/admin/experiments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить эксперимент?")) return;
    await fetch(`/api/admin/experiments/${id}`, { method: "DELETE" });
    fetchData();
  };

  if (loading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-24" />)}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">A/B эксперименты</h1>
          <p className="text-sm text-text-muted mt-1">Тестирование вариантов системного промпта</p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => setAdding(!adding)}>
          <Plus className="h-4 w-4" /> Создать
        </Button>
      </div>

      {adding && (
        <div className="bg-surface border border-accent/30 rounded-2xl p-5 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input placeholder="Название эксперимента" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <select value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent">
              <option value="global_system_prompt">Глобальный системный промпт</option>
            </select>
          </div>
          <input placeholder="Описание (опционально)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent mb-3" />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-text-muted block mb-1">Вариант A (контроль)</label>
              <textarea value={form.variantA} onChange={(e) => setForm({ ...form, variantA: e.target.value })} className="w-full h-32 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent resize-none" />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Вариант B (эксперимент)</label>
              <textarea value={form.variantB} onChange={(e) => setForm({ ...form, variantB: e.target.value })} className="w-full h-32 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent resize-none" />
            </div>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <label className="text-xs text-text-muted">Трафик на вариант B: {form.trafficPct}%</label>
            <input type="range" min={5} max={95} step={5} value={form.trafficPct} onChange={(e) => setForm({ ...form, trafficPct: parseInt(e.target.value) })} className="flex-1" />
          </div>
          <Button variant="gradient" size="sm" onClick={handleCreate}>
            <FlaskConical className="h-3.5 w-3.5" /> Запустить эксперимент
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {experiments.map((exp) => (
          <div key={exp.id} className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <FlaskConical className={`h-5 w-5 ${exp.isActive ? "text-accent" : "text-text-muted"}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{exp.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${exp.isActive ? "bg-success/10 text-success" : "bg-surface-alt text-text-muted"}`}>
                      {exp.isActive ? "Активен" : "Остановлен"}
                    </span>
                    <span className="text-xs text-text-muted">Ключ: {exp.key}</span>
                  </div>
                  {exp.description && <p className="text-xs text-text-muted mt-0.5">{exp.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="secondary" size="sm" onClick={() => handleToggle(exp.id, exp.isActive)}>
                  {exp.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                </Button>
                <button onClick={() => handleDelete(exp.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-alt rounded-xl p-3 border border-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-text-muted">Вариант A (контроль)</span>
                  <span className="text-xs text-text-muted">{100 - exp.trafficPct}% трафика</span>
                </div>
                <div className="text-lg font-bold text-text-primary">{exp.impressionsA.toLocaleString()}</div>
                <p className="text-xs text-text-muted">показов</p>
              </div>
              <div className="bg-surface-alt rounded-xl p-3 border border-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-accent">Вариант B (эксперимент)</span>
                  <span className="text-xs text-text-muted">{exp.trafficPct}% трафика</span>
                </div>
                <div className="text-lg font-bold text-text-primary">{exp.impressionsB.toLocaleString()}</div>
                <p className="text-xs text-text-muted">показов</p>
              </div>
            </div>
          </div>
        ))}
        {experiments.length === 0 && <p className="text-sm text-text-muted text-center py-8">Экспериментов нет</p>}
      </div>
    </div>
  );
}
