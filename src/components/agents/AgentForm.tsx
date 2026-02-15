"use client";

import { useState } from "react";
import { ArrowLeft, Save, Trash2, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { AgentIconPicker } from "./AgentIconPicker";
import { AgentFileUpload } from "./AgentFileUpload";
import { AgentSkillPicker } from "./AgentSkillPicker";
import { AgentMcpPicker } from "./AgentMcpPicker";
import { AgentToolPicker } from "./AgentToolPicker";
import { AgentPluginPicker } from "./AgentPluginPicker";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { Agent, AgentFile } from "@/types/agent";
import { DEFAULT_ICON_COLOR, DEFAULT_AGENT_ICON } from "@/lib/constants";

interface AgentFormProps {
  agent?: Agent;
}

export function AgentForm({ agent }: AgentFormProps) {
  const router = useRouter();
  const isEdit = !!agent;

  const [name, setName] = useState(agent?.name || "");
  const [description, setDescription] = useState(agent?.description || "");
  const [instructions, setInstructions] = useState(agent?.instructions || "");
  const [icon, setIcon] = useState(agent?.icon || DEFAULT_AGENT_ICON);
  const [iconColor, setIconColor] = useState(agent?.iconColor || DEFAULT_ICON_COLOR);
  const [files, setFiles] = useState<AgentFile[]>(agent?.files || []);
  const [avatar, setAvatar] = useState<string | null>(agent?.avatar || null);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>(
    agent?.skills?.map((s) => s.skill.id) || []
  );
  const [selectedMcpIds, setSelectedMcpIds] = useState<string[]>(
    agent?.mcpServers?.map((m) => m.mcpServer.id) || []
  );
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>(
    agent?.tools?.map((t) => t.tool.id) || []
  );
  const [selectedPluginIds, setSelectedPluginIds] = useState<string[]>(
    agent?.plugins?.map((p) => p.plugin.id) || []
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genDescription, setGenDescription] = useState("");
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !instructions.trim()) {
      setError("Заполните название и инструкции");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body = { name, description, instructions, icon, iconColor, avatar, skillIds: selectedSkillIds, mcpServerIds: selectedMcpIds, toolIds: selectedToolIds, pluginIds: selectedPluginIds };

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
    if (!agent) return;
    setShowDeleteConfirm(false);
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

  const handleGenerate = async () => {
    if (!genDescription.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: genDescription }),
      });
      if (!res.ok) throw new Error("Ошибка генерации");
      const data = await res.json();
      if (data.name) setName(data.name);
      if (data.description) setDescription(data.description);
      if (data.instructions) setInstructions(data.instructions);
      if (data.icon) setIcon(data.icon);
      if (data.iconColor) setIconColor(data.iconColor);
      setShowGenPanel(false);
    } catch {
      setError("Не удалось сгенерировать агента");
    } finally {
      setGenerating(false);
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

      {/* AI Generation Panel */}
      <div className="mb-6 rounded-2xl border border-border bg-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setShowGenPanel(!showGenPanel)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            Сгенерировать с ИИ
          </span>
          {showGenPanel ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
        </button>
        {showGenPanel && (
          <div className="px-5 pb-4 space-y-3 border-t border-border pt-3">
            <textarea
              value={genDescription}
              onChange={(e) => setGenDescription(e.target.value)}
              placeholder="Опишите, какого агента вы хотите создать. Например: «Юрист по трудовому праву, специализирующийся на спорах с работодателем»"
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none"
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !genDescription.trim()}
              className="h-9 px-5 rounded-xl bg-gradient-to-r from-accent to-legal-ref text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-60 cursor-pointer"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Генерация..." : "Сгенерировать"}
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Icon Picker */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">
            Иконка
          </label>
          <AgentIconPicker
            selectedIcon={icon}
            selectedColor={iconColor}
            customImage={avatar}
            onIconChange={setIcon}
            onColorChange={setIconColor}
            onCustomImageChange={setAvatar}
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

        {/* Skills */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">
            Скиллы
          </label>
          <AgentSkillPicker
            selectedIds={selectedSkillIds}
            onChange={setSelectedSkillIds}
          />
          <p className="text-xs text-text-muted mt-1">
            Скиллы добавляют специализированные инструкции к системному промпту агента
          </p>
        </div>

        {/* MCP Servers */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">
            MCP-серверы
          </label>
          <AgentMcpPicker
            selectedIds={selectedMcpIds}
            onChange={setSelectedMcpIds}
          />
          <p className="text-xs text-text-muted mt-1">
            MCP-серверы предоставляют агенту дополнительные инструменты
          </p>
        </div>

        {/* Tools */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">
            Инструменты
          </label>
          <AgentToolPicker
            selectedIds={selectedToolIds}
            onChange={setSelectedToolIds}
          />
          <p className="text-xs text-text-muted mt-1">
            Инструменты добавляют быстрые действия и шаблоны к чату с агентом
          </p>
        </div>

        {/* Plugins */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">
            Плагины
          </label>
          <AgentPluginPicker
            selectedIds={selectedPluginIds}
            onChange={setSelectedPluginIds}
          />
          <p className="text-xs text-text-muted mt-1">
            Плагины объединяют инструменты, скиллы и MCP-серверы в пакеты
          </p>
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

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Удалить агента?"
        description="Чаты с этим агентом сохранятся, но агент будет удалён навсегда."
        confirmText="Удалить"
      />
    </div>
  );
}
