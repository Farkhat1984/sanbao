import { useTranslation } from "@/hooks/useTranslation";
import type { ModelFormData } from "./ModelForm";

interface ModelFormPricingProps {
  form: ModelFormData;
  updateField: <K extends keyof ModelFormData>(key: K, value: ModelFormData[K]) => void;
  inputClass: string;
  mode: "create" | "edit";
}

/** Cost and price per 1k input/output tokens (4 fields). */
export function ModelFormPricing({ form, updateField, inputClass, mode }: ModelFormPricingProps) {
  const { t } = useTranslation();

  return (
    <>
      <div>
        {mode === "edit" && <label className="text-xs text-text-secondary block mb-1">{t("adminModels.costPerInputLabel")}</label>}
        <input
          placeholder={t("adminModels.costPerInput")}
          type="number"
          step="0.001"
          value={form.costPer1kInput}
          onChange={(e) => updateField("costPer1kInput", parseFloat(e.target.value) || 0)}
          className={inputClass}
        />
      </div>

      <div>
        {mode === "edit" && <label className="text-xs text-text-secondary block mb-1">{t("adminModels.costPerOutputLabel")}</label>}
        <input
          placeholder={t("adminModels.costPerOutput")}
          type="number"
          step="0.001"
          value={form.costPer1kOutput}
          onChange={(e) => updateField("costPer1kOutput", parseFloat(e.target.value) || 0)}
          className={inputClass}
        />
      </div>

      <div>
        {mode === "edit" && <label className="text-xs text-text-secondary block mb-1">{t("adminModels.pricePerInputLabel")}</label>}
        <input
          placeholder={t("adminModels.pricePerInput")}
          type="number"
          step="0.001"
          value={form.pricePer1kInput}
          onChange={(e) => updateField("pricePer1kInput", parseFloat(e.target.value) || 0)}
          className={inputClass}
        />
      </div>

      <div>
        {mode === "edit" && <label className="text-xs text-text-secondary block mb-1">{t("adminModels.pricePerOutputLabel")}</label>}
        <input
          placeholder={t("adminModels.pricePerOutput")}
          type="number"
          step="0.001"
          value={form.pricePer1kOutput}
          onChange={(e) => updateField("pricePer1kOutput", parseFloat(e.target.value) || 0)}
          className={inputClass}
        />
      </div>
    </>
  );
}
