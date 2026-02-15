"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface TemplateField {
  id: string;
  label: string;
  placeholder: string;
  type: "text" | "date" | "number" | "textarea" | "select";
  options?: string[];
  required: boolean;
}

interface ToolTemplate {
  id: string;
  name: string;
  description: string;
  fields: TemplateField[];
  promptTemplate: string;
}

interface TemplateModalProps {
  template: ToolTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (filledPrompt: string) => void;
}

function fillTemplate(template: ToolTemplate, values: Record<string, string>): string {
  let result = template.promptTemplate;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

export function TemplateModal({
  template,
  isOpen,
  onClose,
  onSubmit,
}: TemplateModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  if (!template) return null;

  const handleChange = (fieldId: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const filledPrompt = fillTemplate(template, values);
    onSubmit(filledPrompt);
    setValues({});
  };

  const isValid = template.fields
    .filter((f) => f.required)
    .every((f) => values[f.id]?.trim());

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={template.name}>
      <p className="text-xs text-text-muted mb-4">{template.description}</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {template.fields.map((field) => (
          <div key={field.id}>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              {field.label}
              {field.required && (
                <span className="text-error ml-0.5">*</span>
              )}
            </label>

            {field.type === "textarea" ? (
              <textarea
                value={values[field.id] || ""}
                onChange={(e) => handleChange(field.id, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                className="w-full bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
              />
            ) : field.type === "select" ? (
              <select
                value={values[field.id] || ""}
                onChange={(e) => handleChange(field.id, e.target.value)}
                className="w-full bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="">Выберите...</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                value={values[field.id] || ""}
                onChange={(e) => handleChange(field.id, e.target.value)}
                placeholder={field.placeholder}
                className="w-full bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            )}
          </div>
        ))}

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={!isValid}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="h-4 w-4" />
            Создать документ
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-border text-sm text-text-secondary hover:bg-surface-alt transition-colors cursor-pointer"
          >
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  );
}
