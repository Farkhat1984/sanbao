"use client";

import { useState } from "react";
import { ArrowLeft, Save, Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { AgentIconPicker } from "./AgentIconPicker";
import { AgentFileUpload } from "./AgentFileUpload";
import type { Agent, AgentFile } from "@/types/agent";

interface AgentFormProps {
  agent?: Agent;
}

export function AgentForm({ agent }: AgentFormProps) {
  const router = useRouter();
  const isEdit = !!agent;

  const [name, setName] = useState(agent?.name || "");
  const [description, setDescription] = useState(agent?.description || "");
  const [instructions, setInstructions] = useState(agent?.instructions || "");
  const [icon, setIcon] = useState(agent?.icon || "Bot");
  const [iconColor, setIconColor] = useState(agent?.iconColor || "#4F6EF7");
  const [files, setFiles] = useState<AgentFile[]>(agent?.files || []);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !instructions.trim()) {
      setError("Заполните название и инструкции");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body = { name, description, instructions, icon, iconColor };

      const res = await fetch(
        isEdit ? `/api/agents/${agent.id}` : "/api/agents",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка сохранения");
      }

      router.push("/agents");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!agent || !confirm("Удалить агента? Чаты с ним сохранятся.")) return;

    setDeleting(true);
    try {
      await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
      router.push("/agents");
      router.refresh();
    } catch {
      setError("Ошибка удаления");
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Back link */}
      <button
        onClick={() => router.push("/agents")}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад к агентам
      </button>

      <h1 className="text-xl font-bold text-text-primary mb-6">
        {isEdit ? "Редактировать агента" : "Создать агента"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Icon Picker */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">
            Иконка
          </label>
          <AgentIconPicker
            selectedIcon={icon}
            selectedColor={iconColor}
            onIconChange={setIcon}
            onColorChange={setIconColor}
          />
        </div>

        {/* Name */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">
            Название <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Юрист по трудовому праву"
            maxLength={50}
            className="w-full h-10 px-4 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">
            Описание
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Краткое описание для карточки агента"
            rows={2}
            className="w-full px-4 py-3 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none"
          />
        </div>

        {/* Instructions */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">
            Инструкции <span className="text-error">*</span>
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Опишите поведение, стиль и специализацию агента. Это будет его системный промпт..."
            rows={8}
            className="w-full px-4 py-3 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-y"
          />
          <p className="text-xs text-text-muted mt-1">
            Системные инструкции определяют поведение агента в каждом чате
          </p>
        </div>

        {/* Files */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">
            Файлы знаний
          </label>
          <AgentFileUpload
            agentId={agent?.id || null}
            files={files}
            onFileAdded={(f) => setFiles((prev) => [...prev, f])}
            onFileRemoved={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
          />
          {!isEdit && (
            <p className="text-xs text-text-muted mt-2">
              Файлы можно будет загрузить после создания агента
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-error/10 border border-error/20">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="h-10 px-6 rounded-xl bg-gradient-to-r from-accent to-legal-ref text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-all shadow-sm disabled:opacity-60 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEdit ? "Сохранить" : "Создать агента"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/agents")}
            className="h-10 px-6 rounded-xl border border-border bg-surface text-sm text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            Отмена
          </button>

          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="h-10 px-4 rounded-xl border border-error/30 text-error text-sm flex items-center gap-2 hover:bg-error/10 transition-colors ml-auto cursor-pointer disabled:opacity-60"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Удалить
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
