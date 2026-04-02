"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Save, Sparkles } from "lucide-react";

interface PlanData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  messagesPerDay: number;
  tokensPerMessage: number;
  tokensPerMonth: number;
  requestsPerMinute: number;
  contextWindowSize: number;
  maxConversations: number;
  maxAgents: number;
  documentsPerMonth: number;
  canUseAgents: boolean;
  canUseMultiAgents: boolean;
  canUseReasoning: boolean;
  canUseSkills: boolean;
  canUseRag: boolean;
  canUseGraph: boolean;
  canUseIntegrations: boolean;
  canChooseProvider: boolean;
  isDefault: boolean;
  highlighted: boolean;
  maxStorageMb: number;
  maxOrganizations: number;
  _count?: { subscriptions: number };
}

interface PlanFormProps {
  plan: PlanData;
  onSave: (id: string, data: Partial<PlanData>) => Promise<void>;
}

export function PlanForm({ plan, onSave }: PlanFormProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: plan.name,
    description: plan.description || "",
    price: plan.price,
    messagesPerDay: plan.messagesPerDay,
    tokensPerMessage: plan.tokensPerMessage,
    tokensPerMonth: plan.tokensPerMonth,
    requestsPerMinute: plan.requestsPerMinute,
    contextWindowSize: plan.contextWindowSize,
    maxConversations: plan.maxConversations,
    maxAgents: plan.maxAgents,
    documentsPerMonth: plan.documentsPerMonth,
    maxStorageMb: plan.maxStorageMb,
    maxOrganizations: plan.maxOrganizations,
    canUseAgents: plan.canUseAgents,
    canUseMultiAgents: plan.canUseMultiAgents,
    canUseReasoning: plan.canUseReasoning,
    canUseIntegrations: plan.canUseIntegrations,
    canUseSkills: plan.canUseSkills,
    canUseRag: plan.canUseRag,
    canUseGraph: plan.canUseGraph,
    canChooseProvider: plan.canChooseProvider,
    highlighted: plan.highlighted,
  });

  const handleSave = async () => {
    setSaving(true);
    await onSave(plan.id, form);
    setSaving(false);
    setEditing(false);
  };

  const numField = (
    label: string,
    key: keyof typeof form,
    hint?: string
  ) => (
    <div>
      <label className="text-xs font-medium text-text-secondary block mb-1">
        {label}
      </label>
      <input
        type="number"
        value={form[key] as number}
        onChange={(e) =>
          setForm({ ...form, [key]: parseInt(e.target.value) || 0 })
        }
        disabled={!editing}
        className="w-full h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary disabled:opacity-60 focus:outline-none focus:border-accent transition-colors"
      />
      {hint && <p className="text-xs text-text-secondary mt-0.5">{hint}</p>}
    </div>
  );

  const toggle = (label: string, key: keyof typeof form) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={form[key] as boolean}
        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
        disabled={!editing}
        className="h-4 w-4 rounded accent-accent"
      />
      <span className="text-sm text-text-secondary">{label}</span>
    </label>
  );

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-text-primary">{plan.name}</h3>
          {plan.highlighted && (
            <Badge variant="accent">
              <Sparkles className="h-3 w-3" />
              Рекомендуемый
            </Badge>
          )}
          {plan.isDefault && <Badge variant="default">По умолчанию</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">
            {plan._count?.subscriptions || 0} подписчиков
          </span>
          {editing ? (
            <Button
              variant="gradient"
              size="sm"
              onClick={handleSave}
              isLoading={saving}
            >
              <Save className="h-3.5 w-3.5" />
              Сохранить
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Редактировать
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">
            Название
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            disabled={!editing}
            className="w-full h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary disabled:opacity-60 focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">
            Цена ($)
          </label>
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
            disabled={!editing}
            className="w-full h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary disabled:opacity-60 focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        {numField("Сообщений/день", "messagesPerDay", "0 = безлимит")}
        {numField("Токенов/сообщение", "tokensPerMessage")}
        {numField("Токенов/месяц", "tokensPerMonth", "0 = безлимит")}
        {numField("Запросов/мин", "requestsPerMinute")}
        {numField("Окно контекста", "contextWindowSize")}
        {numField("Макс. диалогов", "maxConversations", "0 = безлимит")}
        {numField("Макс. агентов", "maxAgents", "0 = безлимит")}
        {numField("Документов/месяц", "documentsPerMonth", "0 = безлимит")}
        {numField("Хранилище (МБ)", "maxStorageMb", "0 = безлимит")}
        {numField("Макс. организаций", "maxOrganizations", "0 = нет")}
      </div>

      <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-border">
        {toggle("Режим рассуждений", "canUseReasoning")}
        {toggle("Скиллы", "canUseSkills")}
        {toggle("База знаний", "canUseRag")}
        {toggle("Агенты", "canUseAgents")}
        {toggle("Мультиагенты", "canUseMultiAgents")}
        {toggle("Интеграции", "canUseIntegrations")}
        {toggle("Рекомендуемый", "highlighted")}
      </div>
    </div>
  );
}
