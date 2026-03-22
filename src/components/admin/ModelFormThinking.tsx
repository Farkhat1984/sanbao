import { useTranslation } from "@/hooks/useTranslation";
import type { ModelFormData } from "./ModelForm";

interface ModelFormThinkingProps {
  form: ModelFormData;
  updateField: <K extends keyof ModelFormData>(key: K, value: ModelFormData[K]) => void;
  mode: "create" | "edit";
}

/** Supports Thinking checkbox and conditional Max Thinking Tokens input. */
export function ModelFormThinking({ form, updateField, mode }: ModelFormThinkingProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-4 mt-3">
      <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
        <input
          type="checkbox"
          checked={form.supportsThinking}
          onChange={(e) => updateField("supportsThinking", e.target.checked)}
          className="rounded"
        />
        {t("adminModels.thinkingSupport")}
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
  );
}
