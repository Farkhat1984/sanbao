"use client";

import { Plus, X, MessageSquare } from "lucide-react";

/** Maximum number of starter prompts allowed per agent. */
const MAX_STARTER_PROMPTS = 6;

interface StarterPromptsEditorProps {
  /** Current list of starter prompt strings. */
  prompts: string[];
  /** Called whenever the list changes (add, edit, remove). */
  onChange: (prompts: string[]) => void;
  /** Max character length per prompt input. Default: 200. */
  maxLength?: number;
}

/**
 * Editable list of starter prompts for agents.
 * Shared between the user-facing AgentForm and admin agent edit page.
 */
export function StarterPromptsEditor({
  prompts,
  onChange,
  maxLength = 200,
}: StarterPromptsEditorProps) {
  const updatePrompt = (idx: number, value: string) => {
    const updated = [...prompts];
    updated[idx] = value;
    onChange(updated);
  };

  const removePrompt = (idx: number) => {
    onChange(prompts.filter((_, i) => i !== idx));
  };

  const addPrompt = () => {
    if (prompts.length < MAX_STARTER_PROMPTS) {
      onChange([...prompts, ""]);
    }
  };

  return (
    <div>
      <label className="text-sm font-medium text-text-primary mb-2 block">
        <span className="flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4 text-text-secondary" />
          Стартовые подсказки
        </span>
      </label>
      <div className="space-y-2">
        {prompts.map((prompt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => updatePrompt(idx, e.target.value)}
              placeholder={`Подсказка ${idx + 1}, например: «Составь договор аренды»`}
              maxLength={maxLength}
              className="flex-1 h-9 px-3 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            <button
              type="button"
              onClick={() => removePrompt(idx)}
              className="h-9 w-9 rounded-xl flex items-center justify-center text-text-secondary hover:text-error hover:bg-error/10 transition-colors cursor-pointer shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {prompts.length < MAX_STARTER_PROMPTS && (
          <button
            type="button"
            onClick={addPrompt}
            className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить подсказку
          </button>
        )}
      </div>
      <p className="text-xs text-text-secondary mt-1">
        Подсказки показываются на экране приветствия агента как быстрые действия (до {MAX_STARTER_PROMPTS} шт.)
      </p>
    </div>
  );
}
