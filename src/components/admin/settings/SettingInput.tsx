"use client";

import { Switch } from "@/components/ui/Switch";
import type { SettingEntry } from "./types";

interface SettingInputProps {
  setting: SettingEntry;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

/** Renders the appropriate input control for a system setting based on its type and validation. */
function SettingInput({ setting, value, error, onChange }: SettingInputProps) {
  const inputClasses = `h-10 px-4 rounded-xl bg-surface border text-sm text-text-primary transition-all duration-150 outline-none focus:shadow-[var(--shadow-input-focus)] ${
    error
      ? "border-error focus:border-error"
      : "border-border focus:border-accent"
  }`;

  // Boolean toggle
  if (setting.type === "boolean") {
    return (
      <div className="flex items-center gap-3">
        <Switch
          checked={value === "true"}
          onChange={(checked) => onChange(checked ? "true" : "false")}
          size="md"
        />
        <span className="text-sm text-text-secondary">
          {value === "true" ? "Включено" : "Выключено"}
        </span>
      </div>
    );
  }

  // String with allowedValues — select dropdown
  if (setting.type === "string" && setting.validation?.allowedValues) {
    return (
      <div className="space-y-1.5">
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full sm:w-64 ${inputClasses} appearance-none pr-10 cursor-pointer`}
          >
            {setting.validation.allowedValues.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  }

  // Number input
  if (setting.type === "number") {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            min={setting.validation?.min}
            max={setting.validation?.max}
            step={setting.validation?.step ?? (Number(value) % 1 !== 0 ? 0.1 : 1)}
            className={`w-full sm:w-48 ${inputClasses}`}
          />
          {setting.unit && (
            <span className="text-xs text-text-muted shrink-0">{setting.unit}</span>
          )}
        </div>
        {setting.validation && (
          <p className="text-[11px] text-text-muted">
            {setting.validation.min !== undefined && `Мин: ${setting.validation.min}`}
            {setting.validation.min !== undefined && setting.validation.max !== undefined && " / "}
            {setting.validation.max !== undefined && `Макс: ${setting.validation.max.toLocaleString()}`}
          </p>
        )}
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  }

  // String input (default)
  return (
    <div className="space-y-1.5">
      <input
        type={setting.sensitive ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={setting.defaultValue}
        className={`w-full sm:w-96 ${inputClasses}`}
      />
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

export { SettingInput };
