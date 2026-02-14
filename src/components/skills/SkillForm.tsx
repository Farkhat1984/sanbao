"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AgentIconPicker } from "@/components/agents/AgentIconPicker";
import { ArrowLeft, Save, Sparkles, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { Skill } from "@/types/skill";

const JURISDICTIONS = [
  { value: "RU", label: "Россия" },
  { value: "KZ", label: "Казахстан" },
  { value: "BY", label: "Беларусь" },
  { value: "EU", label: "Евросоюз" },
  { value: "EU/RU", label: "ЕС + Россия" },
  { value: "International", label: "Международное" },
];

interface SkillFormProps {
  initial?: Skill;
}

export function SkillForm({ initial }: SkillFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genDescription, setGenDescription] = useState("");
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt || "");
  const [citationRules, setCitationRules] = useState(initial?.citationRules || "");
  const [jurisdiction, setJurisdiction] = useState(initial?.jurisdiction || "RU");
  const [icon, setIcon] = useState(initial?.icon || "Scale");
  const [iconColor, setIconColor] = useState(initial?.iconColor || "#4F6EF7");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !systemPrompt.trim()) return;

    setSaving(true);
    try {
      const url = initial ? `/api/skills/${initial.id}` : "/api/skills";
      const method = initial ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          systemPrompt,
          citationRules,
          jurisdiction,
          icon,
          iconColor,
        }),
      });

      if (res.ok) {
        router.push("/skills");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  const handleGenerate = async () => {
    if (!genDescription.trim()) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/skills/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: genDescription, jurisdiction }),
      });
      if (!res.ok) throw new Error("Ошибка генерации");
      const data = await res.json();
      if (data.name) setName(data.name);
      if (data.description) setDescription(data.description);
      if (data.systemPrompt) setSystemPrompt(data.systemPrompt);
      if (data.citationRules) setCitationRules(data.citationRules);
      if (data.jurisdiction) setJurisdiction(data.jurisdiction);
      if (data.icon) setIcon(data.icon);
      if (data.iconColor) setIconColor(data.iconColor);
      setShowGenPanel(false);
    } catch {
      setGenError("Не удалось сгенерировать скилл");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Generation Panel */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setShowGenPanel(!showGenPanel)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            Сгенерировать с ИИ
          </span>
          {showGenPanel ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
        </button>
        {showGenPanel && (
          <div className="px-5 pb-4 space-y-3 border-t border-border pt-3">
            <textarea
              value={genDescription}
              onChange={(e) => setGenDescription(e.target.value)}
              placeholder="Опишите скилл. Например: «Анализ трудовых договоров на соответствие ТК РФ»"
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none"
            />
            {genError && <p className="text-xs text-error">{genError}</p>}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !genDescription.trim()}
              className="h-9 px-5 rounded-xl bg-gradient-to-r from-accent to-legal-ref text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-60 cursor-pointer"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Генерация..." : "Сгенерировать"}
            </button>
          </div>
        )}
      </div>

    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold text-text-primary">
          {initial ? "Редактировать скилл" : "Новый скилл"}
        </h1>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 space-y-5">
        <AgentIconPicker
          selectedIcon={icon}
          selectedColor={iconColor}
          onIconChange={setIcon}
          onColorChange={setIconColor}
        />

        <div>
          <label className="text-xs font-medium text-text-muted mb-1.5 block">
            Название *
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Анализ договоров"
            className="w-full bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            required
          />
        </div>

        <div>
          <label className="text-xs font-medium text-text-muted mb-1.5 block">
            Описание
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Краткое описание скилла"
            className="w-full bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-text-muted mb-1.5 block">
            Юрисдикция
          </label>
          <select
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            className="w-full bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer"
          >
            {JURISDICTIONS.map((j) => (
              <option key={j.value} value={j.value}>
                {j.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-text-muted mb-1.5 block">
            Системный промпт *
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Опишите роль и правила поведения AI при использовании этого скилла..."
            rows={8}
            className="w-full bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
            required
          />
        </div>

        <div>
          <label className="text-xs font-medium text-text-muted mb-1.5 block">
            Правила цитирования
          </label>
          <textarea
            value={citationRules}
            onChange={(e) => setCitationRules(e.target.value)}
            placeholder="Как AI должен ссылаться на правовые нормы..."
            rows={3}
            className="w-full bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" variant="primary" disabled={saving || !name.trim() || !systemPrompt.trim()}>
          <Save className="h-4 w-4" />
          {saving ? "Сохранение..." : initial ? "Сохранить" : "Создать"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
    </div>
  );
}
