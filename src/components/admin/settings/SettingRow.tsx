"use client";

import { RotateCcw, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SettingInput } from "./SettingInput";
import type { SettingEntry } from "./types";

interface SettingRowProps {
  setting: SettingEntry;
  value: string;
  error?: string;
  isDirty: boolean;
  onChange: (key: string, value: string) => void;
  onReset: (key: string) => void;
}

/** A single setting row card with label, badges, description, input, and reset button. */
function SettingRow({
  setting,
  value,
  error,
  isDirty,
  onChange,
  onReset,
}: SettingRowProps) {
  const isDefault = value === setting.defaultValue && !setting.isOverridden;
  const showResetButton = setting.isOverridden || isDirty;

  return (
    <div
      className={`bg-surface border rounded-2xl p-5 transition-colors ${
        error
          ? "border-error/40"
          : isDirty
            ? "border-accent/30"
            : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Label row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text-primary">
              {setting.label}
            </span>
            {isDefault && !isDirty && (
              <Badge variant="default">По умолчанию</Badge>
            )}
            {setting.isOverridden && !isDirty && (
              <Badge variant="accent">Изменено</Badge>
            )}
            {isDirty && <Badge variant="warning">Не сохранено</Badge>}
            {setting.restartRequired && (
              <span className="inline-flex items-center gap-1 text-xs text-warning">
                <AlertTriangle className="h-3 w-3" />
                Требуется перезапуск
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">
            {setting.description}
          </p>

          {/* Key (for devs) */}
          <p className="text-[11px] text-text-muted mt-1 font-mono">
            {setting.key}
          </p>
        </div>

        {/* Reset button */}
        {showResetButton && (
          <button
            onClick={() => onReset(setting.key)}
            title="Сбросить к значению по умолчанию"
            className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-warning hover:bg-warning/10 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Input */}
      <div className="mt-3">
        <SettingInput
          setting={setting}
          value={value}
          error={error}
          onChange={(v) => onChange(setting.key, v)}
        />
      </div>
    </div>
  );
}

export { SettingRow };
