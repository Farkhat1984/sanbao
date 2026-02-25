"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Loader2, Sparkles, ChevronDown, ChevronUp,
  Plus, X, MessageSquare,
} from "lucide-react";
import { AgentIconPicker } from "@/components/agents/AgentIconPicker";
import { AgentSkillPicker } from "@/components/agents/AgentSkillPicker";
import { AgentMcpPicker } from "@/components/agents/AgentMcpPicker";
import { AgentToolPicker } from "@/components/agents/AgentToolPicker";
import { AgentPluginPicker } from "@/components/agents/AgentPluginPicker";
import { DEFAULT_ICON_COLOR, DEFAULT_AGENT_ICON } from "@/lib/constants";

export default function AdminAgentNewPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [icon, setIcon] = useState(DEFAULT_AGENT_ICON);
  const [iconColor, setIconColor] = useState(DEFAULT_ICON_COLOR);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [starterPrompts, setStarterPrompts] = useState<string[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [selectedMcpIds, setSelectedMcpIds] = useState<string[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [selectedPluginIds, setSelectedPluginIds] = useState<string[]>([]);

  // AI generation
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [genDescription, setGenDescription] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !systemPrompt.trim()) {
      setError("Заполните имя и системный промпт");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/system-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          systemPrompt,
          icon,
          iconColor,
          avatar,
          starterPrompts: starterPrompts.filter((s) => s.trim()),
          skillIds: selectedSkillIds,
          mcpServerIds: selectedMcpIds,
          toolIds: selectedToolIds,
          pluginIds: selectedPluginIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка создания");
      }
      router.push("/admin/agents");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания");
    } finally {
      setSaving(false);
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
      if (data.instructions) setSystemPrompt(data.instructions);
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
        onClick={() => router.push("/admin/agents")}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад к агентам
      </button>

      <h1 className="text-xl font-bold text-text-primary mb-6">
        Новый системный агент
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

      <div className="space-y-6">
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
            maxLength={200}
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

        {/* System Prompt */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">
            Системный промпт <span className="text-error">*</span>
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Опишите поведение, стиль и специализацию агента..."
            rows={8}
            className="w-full px-4 py-3 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-y"
          />
          <p className="text-xs text-text-muted mt-1">
            Системные инструкции определяют поведение агента в каждом чате
          </p>
        </div>

        {/* Starter Prompts */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-text-muted" />
              Стартовые подсказки
            </span>
          </label>
          <div className="space-y-2">
            {starterPrompts.map((prompt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => {
                    const updated = [...starterPrompts];
                    updated[idx] = e.target.value;
                    setStarterPrompts(updated);
                  }}
                  placeholder={`Подсказка ${idx + 1}, например: «Составь договор аренды»`}
                  maxLength={200}
                  className="flex-1 h-9 px-3 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setStarterPrompts(starterPrompts.filter((_, i) => i !== idx))}
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {starterPrompts.length < 6 && (
              <button
                type="button"
                onClick={() => setStarterPrompts([...starterPrompts, ""])}
                className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Добавить подсказку
              </button>
            )}
          </div>
          <p className="text-xs text-text-muted mt-1">
            Подсказки показываются на экране приветствия агента как быстрые действия (до 6 шт.)
          </p>
        </div>

        {/* Note about files */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">
            Файлы знаний
          </label>
          <p className="text-xs text-text-muted py-2">
            Файлы можно будет загрузить после создания агента
          </p>
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
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="h-10 px-6 rounded-xl bg-gradient-to-r from-accent to-legal-ref text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-all shadow-sm disabled:opacity-60 cursor-pointer"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Создать агента
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/agents")}
            className="h-10 px-6 rounded-xl border border-border bg-surface text-sm text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
