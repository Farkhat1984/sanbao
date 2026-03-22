import type { ModelFormData } from "./ModelForm";

interface ModelFormParametersProps {
  form: ModelFormData;
  updateField: <K extends keyof ModelFormData>(key: K, value: ModelFormData[K]) => void;
  inputClass: string;
  mode: "create" | "edit";
}

/** Temperature, Top P, Max Tokens, Context Window fields. */
export function ModelFormParameters({ form, updateField, inputClass, mode }: ModelFormParametersProps) {
  return (
    <>
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
    </>
  );
}
