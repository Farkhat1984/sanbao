"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/hooks/useTranslation";
import { DEFAULT_TEMPERATURE_PREVIEW, DEFAULT_MAX_TOKENS, DEFAULT_CONTEXT_WINDOW } from "@/lib/constants";
import { ModelFormIdentity } from "./ModelFormIdentity";
import { ModelFormParameters } from "./ModelFormParameters";
import { ModelFormPricing } from "./ModelFormPricing";
import { ModelFormThinking } from "./ModelFormThinking";

const CATEGORIES = ["TEXT", "IMAGE", "VOICE", "VIDEO", "CODE", "EMBEDDING"] as const;

/** Maps model category enum to translation key */
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  TEXT: "adminModels.categoryText",
  IMAGE: "adminModels.categoryImage",
  VOICE: "adminModels.categoryVoice",
  VIDEO: "adminModels.categoryVideo",
  CODE: "adminModels.categoryCode",
  EMBEDDING: "adminModels.categoryEmbedding",
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
  const { t } = useTranslation();
  const [form, setForm] = useState<ModelFormData>({ ...DEFAULT_FORM, ...initialValues });

  const updateField = <K extends keyof ModelFormData>(key: K, value: ModelFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const inputClass = mode === "edit" ? INPUT_EDIT : INPUT_CREATE;
  const label = submitLabel ?? (mode === "create" ? t("common.create") : t("common.save"));

  return (
    <div>
      {mode === "create" && (
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t("adminModels.newModel")}</h3>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ModelFormIdentity
          form={form}
          updateField={updateField}
          inputClass={inputClass}
          mode={mode}
          providers={providers}
        />
        <ModelFormParameters
          form={form}
          updateField={updateField}
          inputClass={inputClass}
          mode={mode}
        />
        <ModelFormPricing
          form={form}
          updateField={updateField}
          inputClass={inputClass}
          mode={mode}
        />
      </div>

      <ModelFormThinking form={form} updateField={updateField} mode={mode} />

      <div className="flex gap-2 mt-3">
        <Button variant="gradient" size="sm" onClick={() => onSubmit(form)}>
          <Save className="h-3.5 w-3.5" />
          {label}
        </Button>
        {onCancel && (
          <Button variant="secondary" size="sm" onClick={onCancel}>{t("common.cancel")}</Button>
        )}
      </div>
    </div>
  );
}

export type { ModelFormData, Provider as ModelFormProvider };
export { CATEGORIES as MODEL_CATEGORIES, CATEGORY_LABEL_KEYS as MODEL_CATEGORY_LABEL_KEYS };

/**
 * Static label map for backward compatibility.
 * Prefer using t(MODEL_CATEGORY_LABEL_KEYS[cat]) in i18n-aware components.
 */
const CATEGORY_LABELS: Record<string, string> = {
  TEXT: "Текст",
  IMAGE: "Изображения",
  VOICE: "Голос",
  VIDEO: "Видео",
  CODE: "Код",
  EMBEDDING: "Эмбеддинги",
};
export { CATEGORY_LABELS as MODEL_CATEGORY_LABELS };
