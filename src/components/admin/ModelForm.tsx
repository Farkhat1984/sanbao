"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DEFAULT_TEMPERATURE_PREVIEW, DEFAULT_MAX_TOKENS, DEFAULT_CONTEXT_WINDOW } from "@/lib/constants";

const CATEGORIES = ["TEXT", "IMAGE", "VOICE", "VIDEO", "CODE", "EMBEDDING"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  TEXT: "Текст",
  IMAGE: "Изображения",
  VOICE: "Голос",
  VIDEO: "Видео",
  CODE: "Код",
  EMBEDDING: "Эмбеддинги",
};

interface Provider {
  id: string;
  name: string;
  slug: string;
}

interface ModelFormData {
  providerId: string;
  modelId: string;
  displayName: string;
  category: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  contextWindow: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  pricePer1kInput: number;
  pricePer1kOutput: number;
  supportsThinking: boolean;
  maxThinkingTokens: number;
}

interface ModelFormProps {
  mode: "create" | "edit";
  /** Providers list (only used in create mode for the provider dropdown). */
  providers?: Provider[];
  /** Initial form values. Defaults provided for create mode. */
  initialValues?: Partial<ModelFormData>;
  /** Called with form data on submit. */
  onSubmit: (data: ModelFormData) => void;
  /** Called to cancel / close the form (edit mode). */
  onCancel?: () => void;
  /** Submit button label override. Defaults to "Создать" / "Сохранить" based on mode. */
  submitLabel?: string;
}

/** Default values for a new model. */
const DEFAULT_FORM: ModelFormData = {
  providerId: "",
  modelId: "",
  displayName: "",
  category: "TEXT",
  temperature: DEFAULT_TEMPERATURE_PREVIEW,
  topP: 1,
  maxTokens: DEFAULT_MAX_TOKENS,
  contextWindow: DEFAULT_CONTEXT_WINDOW,
  costPer1kInput: 0,
  costPer1kOutput: 0,
  pricePer1kInput: 0,
  pricePer1kOutput: 0,
  supportsThinking: false,
  maxThinkingTokens: 0,
};

const INPUT_BASE = "px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent";
const INPUT_CREATE = `h-9 ${INPUT_BASE} placeholder:text-text-muted`;
const INPUT_EDIT = `w-full h-8 ${INPUT_BASE}`;

/**
 * Unified form for creating and editing AI models in admin panel.
 * Used in both the "add new model" section and the inline edit row.
 */
export function ModelForm({
  mode,
  providers = [],
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}: ModelFormProps) {
  const [form, setForm] = useState<ModelFormData>({ ...DEFAULT_FORM, ...initialValues });

  const updateField = <K extends keyof ModelFormData>(key: K, value: ModelFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const inputClass = mode === "edit" ? INPUT_EDIT : INPUT_CREATE;
  const label = submitLabel ?? (mode === "create" ? "Создать" : "Сохранить");

  return (
    <div>
      {mode === "create" && (
        <h3 className="text-sm font-semibold text-text-primary mb-3">Новая модель</h3>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {mode === "create" && (
          <select
            value={form.providerId}
            onChange={(e) => updateField("providerId", e.target.value)}
            className={inputClass}
          >
            <option value="">Провайдер...</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        {mode === "create" && (
          <input
            placeholder="ID модели у провайдера"
            value={form.modelId}
            onChange={(e) => updateField("modelId", e.target.value)}
            className={inputClass}
          />
        )}

        <div>
          {mode === "edit" && <label className="text-xs text-text-secondary block mb-1">Название</label>}
          <input
            placeholder="Отображаемое имя"
            value={form.displayName}
            onChange={(e) => updateField("displayName", e.target.value)}
            className={inputClass}
          />
        </div>

        {mode === "create" && (
          <select
            value={form.category}
            onChange={(e) => updateField("category", e.target.value)}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        )}

        <div>
          {mode === "edit" && <label className="text-xs text-text-secondary block mb-1">Temperature</label>}
          <input
            placeholder="Temperature"
            type="number"
            step="0.1"
            value={form.temperature}
            onChange={(e) => updateField("temperature", parseFloat(e.target.value) || 0)}
            className={inputClass}
          />
        </div>

        <div>
          {mode === "edit" && <label className="text-xs text-text-secondary block mb-1">Top P</label>}
          <input
            placeholder="Top P"
            type="number"
            step="0.1"
            value={form.topP}
            onChange={(e) => updateField("topP", parseFloat(e.target.value) || 0)}
            className={inputClass}
          />
        </div>

        <div>
          {mode === "edit" && <label className="text-xs text-text-secondary block mb-1">Max Tokens</label>}
          <input
            placeholder="Max Tokens"
            type="number"
            value={form.maxTokens}
            onChange={(e) => updateField("maxTokens", parseInt(e.target.value) || 0)}
            className={inputClass}
          />
        </div>

        <div>
          {mode === "edit" && <label className="text-xs text-text-secondary block mb-1">Context Window</label>}
          <input
            placeholder="Context Window"
            type="number"
            value={form.contextWindow}
            onChange={(e) => updateField("contextWindow", parseInt(e.target.value) || 0)}
            className={inputClass}
          />
        </div>

        <div>
          {mode === "edit" && <label className="text-xs text-text-secondary block mb-1">$/1k input</label>}
          <input
            placeholder="Себест./1k вх"
            type="number"
            step="0.001"
            value={form.costPer1kInput}
            onChange={(e) => updateField("costPer1kInput", parseFloat(e.target.value) || 0)}
            className={inputClass}
          />
        </div>

        <div>
          {mode === "edit" && <label className="text-xs text-text-secondary block mb-1">$/1k output</label>}
          <input
            placeholder="Себест./1k вых"
            type="number"
            step="0.001"
            value={form.costPer1kOutput}
            onChange={(e) => updateField("costPer1kOutput", parseFloat(e.target.value) || 0)}
            className={inputClass}
          />
        </div>

        <div>
          {mode === "edit" && <label className="text-xs text-text-secondary block mb-1">Продажа/1k вх</label>}
          <input
            placeholder="Продажа/1k вх"
            type="number"
            step="0.001"
            value={form.pricePer1kInput}
            onChange={(e) => updateField("pricePer1kInput", parseFloat(e.target.value) || 0)}
            className={inputClass}
          />
        </div>

        <div>
          {mode === "edit" && <label className="text-xs text-text-secondary block mb-1">Продажа/1k вых</label>}
          <input
            placeholder="Продажа/1k вых"
            type="number"
            step="0.001"
            value={form.pricePer1kOutput}
            onChange={(e) => updateField("pricePer1kOutput", parseFloat(e.target.value) || 0)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3">
        <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
          <input
            type="checkbox"
            checked={form.supportsThinking}
            onChange={(e) => updateField("supportsThinking", e.target.checked)}
            className="rounded"
          />
          Поддержка Thinking
        </label>
        {form.supportsThinking && (
          <div>
            {mode === "edit" && <label className="text-xs text-text-secondary block mb-1">Max Thinking Tokens</label>}
            <input
              placeholder="Max Thinking Tokens"
              type="number"
              value={form.maxThinkingTokens}
              onChange={(e) => updateField("maxThinkingTokens", parseInt(e.target.value) || 0)}
              className={mode === "edit"
                ? "w-40 h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
                : "w-48 h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
              }
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <Button variant="gradient" size="sm" onClick={() => onSubmit(form)}>
          <Save className="h-3.5 w-3.5" />
          {label}
        </Button>
        {onCancel && (
          <Button variant="secondary" size="sm" onClick={onCancel}>Отмена</Button>
        )}
      </div>
    </div>
  );
}

export type { ModelFormData, Provider as ModelFormProvider };
export { CATEGORIES as MODEL_CATEGORIES, CATEGORY_LABELS as MODEL_CATEGORY_LABELS };
