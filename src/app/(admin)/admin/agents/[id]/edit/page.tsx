"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Loader2, Sparkles, ChevronDown, ChevronUp,
  Plus, X, MessageSquare, Eye, Send,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AgentIconPicker } from "@/components/agents/AgentIconPicker";
import { AgentSkillPicker } from "@/components/agents/AgentSkillPicker";
import { AgentMcpPicker } from "@/components/agents/AgentMcpPicker";
import { AgentToolPicker } from "@/components/agents/AgentToolPicker";
import { AgentPluginPicker } from "@/components/agents/AgentPluginPicker";
import { AgentFileUpload } from "@/components/agents/AgentFileUpload";
import type { AgentFile } from "@/types/agent";
import { DEFAULT_ICON_COLOR, DEFAULT_AGENT_ICON } from "@/lib/constants";

interface SystemAgentData {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  icon: string;
  iconColor: string;
  avatar?: string | null;
  model: string;
  isActive: boolean;
  starterPrompts: string[];
  files: AgentFile[];
  skills: Array<{ id: string; name: string }>;
  mcpServers: Array<{ id: string; name: string }>;
  tools: Array<{ id: string; name: string }>;
  plugins: Array<{ id: string; name: string }>;
}

export default function AdminAgentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [selectedMcpIds, setSelectedMcpIds] = useState<string[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [selectedPluginIds, setSelectedPluginIds] = useState<string[]>([]);

  // AI generation
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [genDescription, setGenDescription] = useState("");
  const [generating, setGenerating] = useState(false);

  // Preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewInput, setPreviewInput] = useState("");
  const [previewMessages, setPreviewMessages] = useState<{ role: string; content: string }[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    params.then(({ id }) => {
      setAgentId(id);
      fetch(`/api/admin/system-agents/${id}`)
        .then((r) => {
          if (!r.ok) throw new Error("Агент не найден");
          return r.json();
        })
        .then((data: SystemAgentData) => {
          setName(data.name);
          setDescription(data.description || "");
          setSystemPrompt(data.systemPrompt);
          setIcon(data.icon);
          setIconColor(data.iconColor);
          setAvatar(data.avatar || null);
          setStarterPrompts(data.starterPrompts || []);
          setFiles(data.files || []);
          setSelectedSkillIds(data.skills?.map((s) => s.id) || []);
          setSelectedMcpIds(data.mcpServers?.map((m) => m.id) || []);
          setSelectedToolIds(data.tools?.map((t) => t.id) || []);
          setSelectedPluginIds(data.plugins?.map((p) => p.id) || []);
        })
        .catch(() => setError("Не удалось загрузить агента"))
        .finally(() => setLoading(false));
    });
  }, [params]);

  const handleSave = async () => {
    if (!name.trim() || !systemPrompt.trim()) {
      setError("Заполните имя и системный промпт");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/system-agents/${agentId}`, {
        method: "PUT",
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
        throw new Error(data.error || "Ошибка сохранения");
      }
      router.push("/admin/agents");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
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

  const handlePreviewSend = async () => {
    if (!previewInput.trim() || previewLoading) return;
    const userMsg = previewInput.trim();
    setPreviewInput("");
    setPreviewMessages((m) => [...m, { role: "user", content: userMsg }]);
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/admin/system-agents/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, message: userMsg }),
      });
      const data = await res.json();
      setPreviewMessages((m) => [...m, { role: "assistant", content: data.reply || data.error || "Нет ответа" }]);
    } catch {
      setPreviewMessages((m) => [...m, { role: "assistant", content: "Ошибка при отправке" }]);
    }
    setPreviewLoading(false);
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-20" />
          ))}
        </div>
      </div>
    );
  }

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

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">
          Редактировать системного агента
        </h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => { setShowPreview(true); setPreviewMessages([]); setPreviewInput(""); }}
        >
          <Eye className="h-3.5 w-3.5" />
          Предпросмотр
        </Button>
      </div>

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

        {/* Files */}
        {agentId && (
          <div>
            <label className="text-sm font-medium text-text-primary mb-2 block">
              Файлы знаний
            </label>
            <AgentFileUpload
              agentId={agentId}
              files={files}
              onFileAdded={(f) => setFiles((prev) => [...prev, f])}
              onFileRemoved={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
              onFileUpdated={(f) => setFiles((prev) => prev.map((pf) => pf.id === f.id ? f : pf))}
            />
          </div>
        )}

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
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-6 rounded-xl bg-gradient-to-r from-accent to-legal-ref text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-all shadow-sm disabled:opacity-60 cursor-pointer"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить
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

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: iconColor }}>{icon.charAt(0)}</div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{name || "Без имени"}</h3>
                  <p className="text-xs text-text-muted">Предпросмотр агента</p>
                </div>
              </div>
              <button onClick={() => setShowPreview(false)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
              {previewMessages.length === 0 && (
                <p className="text-xs text-text-muted text-center py-8">Напишите сообщение, чтобы протестировать агента</p>
              )}
              {previewMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${m.role === "user" ? "bg-accent text-white" : "bg-surface-alt text-text-primary border border-border"}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {previewLoading && (
                <div className="flex justify-start">
                  <div className="bg-surface-alt border border-border rounded-xl px-3 py-2 text-sm text-text-muted animate-pulse">Думает...</div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border flex gap-2">
              <input
                value={previewInput}
                onChange={(e) => setPreviewInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePreviewSend()}
                placeholder="Введите сообщение..."
                className="flex-1 h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <Button variant="gradient" size="sm" onClick={handlePreviewSend} isLoading={previewLoading}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
