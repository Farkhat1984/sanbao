"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Paperclip, Wrench, StopCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { ToolsPanel } from "@/components/legal-tools/ToolsPanel";
import { cn } from "@/lib/utils";

export function MessageInput() {
  const [input, setInput] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isStreaming, addMessage, setStreaming } = useChatStore();

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    addMessage({
      id: crypto.randomUUID(),
      role: "USER",
      content: trimmed,
      createdAt: new Date().toISOString(),
    });

    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // TODO: Call chat API route with streaming
    setStreaming(true);

    // Simulated response for now
    setTimeout(() => {
      addMessage({
        id: crypto.randomUUID(),
        role: "ASSISTANT",
        content:
          "Я анализирую ваш запрос. Это демо-ответ — реальная интеграция с AI будет подключена через API-роут `/api/chat`.\n\nВ рабочей версии здесь будет стриминг ответов с кликабельными ссылками на статьи НПА.",
        createdAt: new Date().toISOString(),
      });
      setStreaming(false);
    }, 1500);
  }, [input, isStreaming, addMessage, setStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  return (
    <div
      className={cn(
        "relative rounded-[32px] transition-all duration-300",
        "bg-surface border border-border",
        isFocused && "shadow-[var(--shadow-input-focus)] border-transparent gradient-border"
      )}
    >
      {/* Textarea */}
      <div className="flex items-end gap-2 px-4 py-3">
        {/* Attach button */}
        <button
          className="h-8 w-8 rounded-xl flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors shrink-0 mb-0.5 cursor-pointer"
          title="Прикрепить файл"
        >
          <Paperclip className="h-4 w-4" />
        </button>

        {/* Tools button */}
        <div className="relative">
          <button
            onClick={() => setToolsOpen(!toolsOpen)}
            className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center transition-colors shrink-0 mb-0.5 cursor-pointer",
              toolsOpen
                ? "text-accent bg-accent-light"
                : "text-text-muted hover:text-text-primary hover:bg-surface-alt"
            )}
            title="Юридические инструменты"
          >
            <Wrench className="h-4 w-4" />
          </button>
          <ToolsPanel isOpen={toolsOpen} onClose={() => setToolsOpen(false)} />
        </div>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Задайте юридический вопрос..."
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none leading-relaxed max-h-[200px] py-1"
        />

        {/* Send / Stop */}
        <AnimatePresence mode="wait">
          {isStreaming ? (
            <motion.button
              key="stop"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={() => setStreaming(false)}
              className="h-9 w-9 rounded-full bg-error text-white flex items-center justify-center hover:bg-red-600 transition-colors shrink-0 cursor-pointer"
            >
              <StopCircle className="h-4 w-4" />
            </motion.button>
          ) : (
            <motion.button
              key="send"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={handleSubmit}
              disabled={!input.trim()}
              className={cn(
                "h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer",
                input.trim()
                  ? "bg-gradient-to-r from-accent to-legal-ref text-white shadow-md hover:shadow-lg"
                  : "bg-surface-alt text-text-muted"
              )}
            >
              <Send className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom hint */}
      <div className="px-5 pb-2 flex items-center justify-between">
        <span className="text-[10px] text-text-muted">
          Enter — отправить, Shift+Enter — новая строка
        </span>
        <span className="text-[10px] text-text-muted">
          Leema может ошибаться. Проверяйте юридическую информацию.
        </span>
      </div>
    </div>
  );
}
