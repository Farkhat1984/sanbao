import { useTranslation } from "@/hooks/useTranslation";
import type { ModelFormData, ModelFormProvider } from "./ModelForm";

const CATEGORIES = ["TEXT", "IMAGE", "VOICE", "VIDEO", "CODE", "EMBEDDING"] as const;

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  TEXT: "adminModels.categoryText",
  IMAGE: "adminModels.categoryImage",
  VOICE: "adminModels.categoryVoice",
  VIDEO: "adminModels.categoryVideo",
  CODE: "adminModels.categoryCode",
  EMBEDDING: "adminModels.categoryEmbedding",
};

interface ModelFormIdentityProps {
  form: ModelFormData;
  updateField: <K extends keyof ModelFormData>(key: K, value: ModelFormData[K]) => void;
  inputClass: string;
  mode: "create" | "edit";
  providers: ModelFormProvider[];
}

/**
 * Identity section: Provider select, Model ID, Display Name, Category select.
 * Provider/ModelID/Category fields only render in create mode.
 */
export function ModelFormIdentity({ form, updateField, inputClass, mode, providers }: ModelFormIdentityProps) {
  const { t } = useTranslation();

  return (
    <>
      {mode === "create" && (
        <select
          value={form.providerId}
          onChange={(e) => updateField("providerId", e.target.value)}
          className={inputClass}
        >
          <option value="">{t("adminModels.provider")}</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}

      {mode === "create" && (
        <input
          placeholder={t("adminModels.modelId")}
          value={form.modelId}
          onChange={(e) => updateField("modelId", e.target.value)}
          className={inputClass}
        />
      )}

      <div>
        {mode === "edit" && <label className="text-xs text-text-secondary block mb-1">{t("adminModels.displayNameLabel")}</label>}
        <input
          placeholder={t("adminModels.displayName")}
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
            <option key={c} value={c}>{t(CATEGORY_LABEL_KEYS[c])}</option>
          ))}
        </select>
      )}
    </>
  );
}
