"use client";

import { useState } from "react";
import { ArrowLeft, Save, Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { AgentIconPicker } from "./AgentIconPicker";
import { AgentFileUpload } from "./AgentFileUpload";
import { AgentPicker } from "./AgentPicker";
import { StarterPromptsEditor } from "./StarterPromptsEditor";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { AgentFile } from "@/types/agent";

interface MultiAgentFormProps {
  orgId: string;
  multiAgent?: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    iconColor: string | null;
    starterPrompts: string[];
    members: Array<{ agentType: string; agentId: string }>;
    files?: AgentFile[];
  };
  /** Whether the user's plan supports knowledge files (canUseRag) */
  canUseRag?: boolean;
}

export function MultiAgentForm({ orgId, multiAgent, canUseRag = false }: MultiAgentFormProps) {
  const router = useRouter();
  const isEdit = !!multiAgent;

  const [name, setName] = useState(multiAgent?.name || "");
  const [description, setDescription] = useState(multiAgent?.description || "");
  const [icon, setIcon] = useState(multiAgent?.icon || "Network");
  const [iconColor, setIconColor] = useState(multiAgent?.iconColor || "#f59e0b");
  const [starterPrompts, setStarterPrompts] = useState<string[]>(
    multiAgent?.starterPrompts || [],
  );
  const [selectedAgents, setSelectedAgents] = useState<Array<{ type: string; id: string }>>(
    multiAgent?.members?.map((m) => ({ type: m.agentType, id: m.agentId })) || [],
  );
  const [files, setFiles] = useState<AgentFile[]>(multiAgent?.files || []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const backUrl = `/organizations/${orgId}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Заполните название");
      return;
    }
    if (selectedAgents.length < 2) {
      setError("Выберите минимум 2 агентов");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = isEdit
        ? `/api/organizations/${orgId}/multiagents/${multiAgent.id}`
        : `/api/organizations/${orgId}/multiagents`;

      const body = {
        name,
        description,
        icon,
        iconColor,
        starterPrompts: starterPrompts.filter((s) => s.trim()),
        agents: selectedAgents,
      };

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка сохранения");
      }

      const created = await res.json();

      // Upload pending files after multi-agent creation
      if (!isEdit && pendingFiles.length > 0 && created?.id) {
        const filesUrl = `/api/organizations/${orgId}/multiagents/${created.id}/files`;
        for (const file of pendingFiles) {
          const formData = new FormData();
          formData.append("file", file);
          await fetch(filesUrl, { method: "POST", body: formData });
        }
      }

      router.push(backUrl);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!multiAgent) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await fetch(`/api/organizations/${orgId}/multiagents/${multiAgent.id}`, {
        method: "DELETE",
      });
      router.push(backUrl);
      router.refresh();
    } catch {
      setError("Ошибка удаления");
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <button
        onClick={() => router.push(backUrl)}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад
      </button>

      <h1 className="text-xl font-bold text-text-primary mb-6 font-[family-name:var(--font-display)]">
        {isEdit ? "Редактировать мультиагента" : "Создать мультиагента"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Identity */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Идентичность</h2>
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-text-primary mb-2 block">Иконка</label>
              <AgentIconPicker
                selectedIcon={icon}
                selectedColor={iconColor}
                onIconChange={setIcon}
                onColorChange={setIconColor}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-2 block">
                Название <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Юридическая команда"
                maxLength={50}
                className="w-full h-10 px-4 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-2 block">Описание</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Краткое описание для карточки мультиагента"
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Starter Prompts */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Поведение</h2>
          <StarterPromptsEditor prompts={starterPrompts} onChange={setStarterPrompts} />
        </div>

        {/* Section 3: Capabilities (Knowledge Files) */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Возможности</h2>
          <div>
            <label className="text-sm font-medium text-text-primary mb-2 block">
              Файлы знаний
            </label>
            <AgentFileUpload
              agentId={multiAgent?.id || null}
              files={files}
              onFileAdded={(f) => setFiles((prev) => [...prev, f])}
              onFileRemoved={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
              onFileUpdated={(f) => setFiles((prev) => prev.map((pf) => pf.id === f.id ? f : pf))}
              onQueuedFilesChange={!isEdit ? setPendingFiles : undefined}
              uploadUrl={multiAgent?.id ? `/api/organizations/${orgId}/multiagents/${multiAgent.id}/files` : undefined}
              disabled={!canUseRag}
              disabledMessage="Файлы знаний доступны только на тарифе Business"
            />
          </div>
        </div>

        {/* Section 4: Agent selection */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Команда агентов</h2>
          <p className="text-xs text-text-secondary mb-4">
            Выберите агентов, которые будут работать вместе. Мультиагент распределяет запросы между
            ними и синтезирует общий ответ.
          </p>
          <AgentPicker
            selectedAgents={selectedAgents}
            onChange={setSelectedAgents}
            orgId={orgId}
          />
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
            className="h-10 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium flex items-center gap-2 transition-all shadow-sm disabled:opacity-60 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEdit ? "Сохранить" : "Создать мультиагента"}
          </button>

          <button
            type="button"
            onClick={() => router.push(backUrl)}
            className="h-10 px-6 rounded-xl border border-border bg-surface text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            Отмена
          </button>

          {isEdit && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
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

      {isEdit && (
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          title="Удалить мультиагента?"
          description="Мультиагент будет удалён навсегда."
          confirmText="Удалить"
        />
      )}
    </div>
  );
}
