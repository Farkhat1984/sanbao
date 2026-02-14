"use client";

import { useState, useEffect } from "react";
import { useMemoryStore } from "@/stores/memoryStore";
import { MEMORY_KEYS, type MemoryKey } from "@/types/memory";
import { Button } from "@/components/ui/Button";
import { Trash2, Plus, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function MemoryManager() {
  const { memories, setMemories, addMemory, removeMemory, setLoading, isLoading } =
    useMemoryStore();
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/memory")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setMemories(data);
      })
      .finally(() => setLoading(false));
  }, [setMemories, setLoading]);

  const usedKeys = new Set(memories.map((m) => m.key));
  const availableKeys = Object.entries(MEMORY_KEYS).filter(
    ([key]) => !usedKeys.has(key)
  );

  async function handleSave() {
    if (!addingKey || !newContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: addingKey, content: newContent.trim() }),
      });
      if (res.ok) {
        const memory = await res.json();
        addMemory(memory);
        setAddingKey(null);
        setNewContent("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/memory/${id}`, { method: "DELETE" });
    if (res.ok) removeMemory(id);
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-surface-alt rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {memories.length === 0 && !addingKey && (
        <p className="text-sm text-text-muted py-2">
          Память пуста. AI будет запоминать ваши предпочтения в процессе работы.
        </p>
      )}

      {memories.map((m) => (
        <div
          key={m.id}
          className="flex items-start gap-3 p-3 rounded-xl bg-surface-alt border border-border group"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-muted mb-0.5">
              {MEMORY_KEYS[m.key as MemoryKey] || m.key}
            </p>
            <p className="text-sm text-text-primary break-words">{m.content}</p>
          </div>
          <button
            onClick={() => handleDelete(m.id)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-red-50 dark:hover:bg-red-950 transition-all cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {addingKey ? (
        <div className="p-3 rounded-xl border border-accent/30 bg-accent-light/50 space-y-2">
          <p className="text-xs font-medium text-accent">
            {MEMORY_KEYS[addingKey as MemoryKey] || addingKey}
          </p>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Введите значение..."
            rows={2}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving || !newContent.trim()}
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAddingKey(null);
                setNewContent("");
              }}
            >
              <X className="h-3.5 w-3.5" />
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        availableKeys.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {availableKeys.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setAddingKey(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                  "text-text-muted border border-dashed border-border",
                  "hover:border-accent hover:text-accent transition-colors cursor-pointer"
                )}
              >
                <Plus className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
