"use client";

import { useState, useEffect } from "react";
import { Save, RotateCcw, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface PromptItem {
  key: string;
  label: string;
  description: string;
  currentValue: string;
  isDefault: boolean;
  updatedAt: string | null;
}

interface PromptVersion {
  id: string;
  version: number;
  content: string;
  changelog: string | null;
  authorId: string;
  createdAt: string;
}

export default function AdminPromptsPage() {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [changelogs, setChangelogs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [versions, setVersions] = useState<Record<string, PromptVersion[]>>({});
  const [showVersions, setShowVersions] = useState<Record<string, boolean>>({});

  const fetchPrompts = async () => {
    const res = await fetch("/api/admin/prompts");
    if (res.ok) {
      const data: PromptItem[] = await res.json();
      setPrompts(data);
      const edits: Record<string, string> = {};
      for (const p of data) edits[p.key] = p.currentValue;
      setEditValues(edits);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPrompts(); }, []);

  const handleSave = async (key: string) => {
    setSaving(key);
    const res = await fetch("/api/admin/prompts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        content: editValues[key],
        changelog: changelogs[key] || undefined,
      }),
    });
    if (res.ok) {
      setChangelogs((c) => ({ ...c, [key]: "" }));
      await fetchPrompts();
      // Refresh versions if open
      if (showVersions[key]) loadVersions(key);
    }
    setSaving(null);
  };

  const handleReset = async (key: string) => {
    if (!confirm("Сбросить промпт к значению по умолчанию? Текущие изменения будут потеряны.")) return;
    setSaving(key);
    const res = await fetch("/api/admin/prompts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (res.ok) {
      await fetchPrompts();
      if (showVersions[key]) loadVersions(key);
    }
    setSaving(null);
  };

  const loadVersions = async (key: string) => {
    const res = await fetch(`/api/admin/prompt-versions?key=${key}`);
    if (res.ok) {
      const data = await res.json();
      setVersions((v) => ({ ...v, [key]: data }));
    }
  };

  const toggleVersions = (key: string) => {
    const next = !showVersions[key];
    setShowVersions((v) => ({ ...v, [key]: next }));
    if (next && !versions[key]) loadVersions(key);
  };

  const restoreVersion = (key: string, content: string) => {
    setEditValues((e) => ({ ...e, [key]: content }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">Управление промптами</h1>
        <p className="text-sm text-text-muted mt-1">
          Редактирование всех системных промптов с версионированием
        </p>
      </div>

      <div className="space-y-3">
        {prompts.map((prompt) => {
          const isExpanded = expandedKey === prompt.key;
          const hasChanges = editValues[prompt.key] !== prompt.currentValue;

          return (
            <div key={prompt.key} className="bg-surface border border-border rounded-2xl overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setExpandedKey(isExpanded ? null : prompt.key)}
                className="w-full flex items-center justify-between p-5 text-left cursor-pointer hover:bg-surface-alt/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{prompt.label}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        prompt.isDefault
                          ? "bg-surface-alt text-text-muted"
                          : "bg-accent/10 text-accent"
                      }`}
                    >
                      {prompt.isDefault ? "По умолчанию" : "Изменён"}
                    </span>
                    {hasChanges && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">
                        Не сохранено
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 truncate">{prompt.description}</p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-text-muted shrink-0 ml-3" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-text-muted shrink-0 ml-3" />
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-border p-5 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-text-muted block mb-1.5">
                      Содержимое промпта
                    </label>
                    <textarea
                      value={editValues[prompt.key] || ""}
                      onChange={(e) =>
                        setEditValues((ev) => ({ ...ev, [prompt.key]: e.target.value }))
                      }
                      className="w-full min-h-[300px] px-4 py-3 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-y font-mono leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-muted block mb-1.5">
                      Changelog (опционально)
                    </label>
                    <input
                      value={changelogs[prompt.key] || ""}
                      onChange={(e) =>
                        setChangelogs((c) => ({ ...c, [prompt.key]: e.target.value }))
                      }
                      placeholder="Описание изменений..."
                      className="w-full h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="gradient"
                      size="sm"
                      onClick={() => handleSave(prompt.key)}
                      isLoading={saving === prompt.key}
                    >
                      <Save className="h-3.5 w-3.5" /> Сохранить
                    </Button>
                    {!prompt.isDefault && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleReset(prompt.key)}
                        isLoading={saving === prompt.key}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Сбросить
                      </Button>
                    )}
                  </div>

                  {/* Version history */}
                  <div className="border-t border-border pt-3">
                    <button
                      onClick={() => toggleVersions(prompt.key)}
                      className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      История версий
                      {showVersions[prompt.key] ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>

                    {showVersions[prompt.key] && (
                      <div className="mt-2 space-y-1.5 max-h-60 overflow-y-auto">
                        {(versions[prompt.key] || []).length === 0 ? (
                          <p className="text-xs text-text-muted py-2">Нет истории версий</p>
                        ) : (
                          (versions[prompt.key] || []).map((v) => (
                            <button
                              key={v.id}
                              onClick={() => restoreVersion(prompt.key, v.content)}
                              className="w-full text-left p-2.5 rounded-lg bg-surface-alt/50 hover:bg-surface-alt border border-border transition-colors cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-text-primary">
                                  v{v.version}
                                </span>
                                <span className="text-[10px] text-text-muted">
                                  {new Date(v.createdAt).toLocaleString("ru-RU")}
                                </span>
                              </div>
                              {v.changelog && (
                                <p className="text-[11px] text-text-muted mt-0.5">{v.changelog}</p>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
