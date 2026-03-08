"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Sparkles, Loader2, Wand2, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { AgentIconPicker } from "@/components/agents/AgentIconPicker";
import { SKILL_CATEGORIES, DEFAULT_ICON_COLOR, DEFAULT_SKILL_ICON } from "@/lib/constants";

type TabId = "ai" | "manual";

interface CreatedSkill {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  category: string;
}

interface InlineSkillCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (skill: CreatedSkill) => void;
}

export function InlineSkillCreateModal({
  isOpen,
  onClose,
  onCreated,
}: InlineSkillCreateModalProps) {
  const [tab, setTab] = useState<TabId>("ai");

  // AI Generate state
  const [aiDescription, setAiDescription] = useState("");
  const [aiCategory, setAiCategory] = useState("CUSTOM");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Manual state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [category, setCategory] = useState("CUSTOM");
  const [icon, setIcon] = useState(DEFAULT_SKILL_ICON);
  const [iconColor, setIconColor] = useState(DEFAULT_ICON_COLOR);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  function resetState() {
    setTab("ai");
    setAiDescription("");
    setAiCategory("CUSTOM");
    setAiError(null);
    setName("");
    setDescription("");
    setSystemPrompt("");
    setCategory("CUSTOM");
    setIcon(DEFAULT_SKILL_ICON);
    setIconColor(DEFAULT_ICON_COLOR);
    setManualError(null);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleAiGenerate() {
    if (!aiDescription.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/skills/quick-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: aiDescription,
          category: aiCategory,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Ошибка генерации");
      }
      const skill = await res.json();
      onCreated({
        id: skill.id,
        name: skill.name,
        icon: skill.icon || DEFAULT_SKILL_ICON,
        iconColor: skill.iconColor || DEFAULT_ICON_COLOR,
        category: skill.category || aiCategory,
      });
      resetState();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Не удалось создать скилл");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleManualCreate() {
    if (!name.trim() || !systemPrompt.trim()) return;
    setManualLoading(true);
    setManualError(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          systemPrompt,
          category,
          icon,
          iconColor,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Ошибка создания");
      }
      const skill = await res.json();
      onCreated({
        id: skill.id,
        name: skill.name,
        icon: skill.icon || icon,
        iconColor: skill.iconColor || iconColor,
        category: skill.category || category,
      });
      resetState();
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "Не удалось создать скилл");
    } finally {
      setManualLoading(false);
    }
  }

  const tabs: { id: TabId; label: string; icon: typeof Wand2 }[] = [
    { id: "ai", label: "ИИ-генерация", icon: Wand2 },
    { id: "manual", label: "Вручную", icon: FileText },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-lg mx-4 sm:mx-0 bg-surface border border-border rounded-2xl shadow-xl max-h-[85vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                Создать скилл
              </h3>
              <button
                onClick={handleClose}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border shrink-0">
              {tabs.map(({ id, label, icon: TabIcon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                    tab === id
                      ? "text-accent border-b-2 border-accent"
                      : "text-text-secondary hover:text-text-primary",
                  )}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto flex-1">
              {tab === "ai" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                      Опишите скилл
                    </label>
                    <textarea
                      value={aiDescription}
                      onChange={(e) => setAiDescription(e.target.value)}
                      placeholder="Например: «Анализ трудовых договоров на соответствие ТК РК»"
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                      Категория
                    </label>
                    <select
                      value={aiCategory}
                      onChange={(e) => setAiCategory(e.target.value)}
                      className="w-full h-10 px-4 rounded-xl bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent transition-colors cursor-pointer appearance-none"
                    >
                      {SKILL_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {aiError && (
                    <p className="text-xs text-error">{aiError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={aiLoading || !aiDescription.trim()}
                    className="w-full h-10 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {aiLoading ? "Генерация..." : "Сгенерировать и создать"}
                  </button>
                </div>
              )}

              {tab === "manual" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                      Название *
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Анализ договоров"
                      className="w-full bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                      Описание
                    </label>
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Краткое описание скилла"
                      className="w-full bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                      Категория
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full h-10 px-4 rounded-xl bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent transition-colors cursor-pointer appearance-none"
                    >
                      {SKILL_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                      Системный промпт *
                    </label>
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="Опишите роль и правила поведения AI..."
                      rows={5}
                      className="w-full bg-surface-alt border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
                    />
                  </div>
                  <AgentIconPicker
                    selectedIcon={icon}
                    selectedColor={iconColor}
                    onIconChange={setIcon}
                    onColorChange={setIconColor}
                  />
                  {manualError && (
                    <p className="text-xs text-error">{manualError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleManualCreate}
                    disabled={manualLoading || !name.trim() || !systemPrompt.trim()}
                    className="w-full h-10 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
                  >
                    {manualLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {manualLoading ? "Создание..." : "Создать"}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
