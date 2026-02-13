"use client";

import { useState, useRef, useCallback } from "react";
import {
  Send,
  StopCircle,
  Plus,
  Paperclip,
  Wrench,
  Globe,
  Brain,
  X,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { ToolsPanel } from "@/components/legal-tools/ToolsPanel";
import { cn } from "@/lib/utils";

const CHAT_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
];
const CHAT_ACCEPTED_EXTENSIONS = ".png,.jpg,.jpeg,.webp,.txt,.md";
const CHAT_MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

interface AttachedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  base64?: string;
  preview?: string;
  textContent?: string;
}

export function MessageInput() {
  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const {
    messages,
    isStreaming,
    activeAgentId,
    thinkingEnabled,
    webSearchEnabled,
    addMessage,
    updateLastAssistantMessage,
    setStreaming,
    setStreamingPhase,
    setToolWorking,
    toggleThinking,
    toggleWebSearch,
  } = useChatStore();

  const activeFeatures = [
    ...(thinkingEnabled ? ["thinking"] : []),
    ...(webSearchEnabled ? ["search"] : []),
  ];

  // ─── File handling ───────────────────────────────────────

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      for (const file of Array.from(files)) {
        if (file.size > CHAT_MAX_FILE_SIZE) {
          alert(`Файл "${file.name}" слишком большой (макс. 20MB)`);
          continue;
        }

        const isImage = file.type.startsWith("image/");
        const isText =
          file.type === "text/plain" || file.name.endsWith(".md");

        if (!isImage && !isText) {
          alert(
            `Формат "${file.name}" не поддерживается.\nПоддерживаются: PNG, JPG, WebP, TXT, MD`
          );
          continue;
        }

        const attached: AttachedFile = {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type || (file.name.endsWith(".md") ? "text/plain" : ""),
          size: file.size,
        };

        if (isImage) {
          const dataUrl = await readFileAsDataUrl(file);
          attached.preview = dataUrl;
          // Extract base64 from data URL
          attached.base64 = dataUrl.split(",")[1];
        } else {
          attached.textContent = await readFileAsText(file);
        }

        setAttachedFiles((prev) => [...prev, attached]);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    []
  );

  const removeFile = useCallback((id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // ─── Submit ──────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if ((!trimmed && attachedFiles.length === 0) || isStreaming) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: "USER" as const,
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    addMessage(userMessage);
    setInput("");
    const filesToSend = [...attachedFiles];
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setStreaming(true);
    setStreamingPhase(thinkingEnabled ? "thinking" : "answering");

    try {
      const apiMessages = [...messages, userMessage].map((m) => ({
        role: m.role.toLowerCase(),
        content: m.content,
      }));

      // Prepare attachments for API
      const attachmentsPayload = filesToSend.map((f) => ({
        name: f.name,
        type: f.type,
        ...(f.base64 ? { base64: f.base64 } : {}),
        ...(f.textContent ? { textContent: f.textContent } : {}),
      }));

      abortRef.current = new AbortController();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          provider: "deepinfra",
          agentId: activeAgentId,
          thinkingEnabled,
          webSearchEnabled,
          attachments: attachmentsPayload,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Неизвестная ошибка" }));
        addMessage({
          id: crypto.randomUUID(),
          role: "ASSISTANT",
          content: `Ошибка: ${error.error || "Не удалось получить ответ"}`,
          createdAt: new Date().toISOString(),
        });
        setStreaming(false);
        return;
      }

      addMessage({
        id: crypto.randomUUID(),
        role: "ASSISTANT",
        content: "",
        createdAt: new Date().toISOString(),
      });

      // Parse NDJSON stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let fullReasoning = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop()!;

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            switch (data.t) {
              case "r": // reasoning
                fullReasoning += data.v;
                updateLastAssistantMessage(fullContent, fullReasoning);
                break;
              case "c": // content
                if (!fullContent) {
                  setStreamingPhase("answering");
                  setToolWorking(false);
                }
                fullContent += data.v;
                updateLastAssistantMessage(
                  fullContent,
                  fullReasoning || undefined
                );
                break;
              case "s": // web search status
                setToolWorking(true, `Поиск: ${data.v}`);
                break;
              case "e": // error
                if (!fullContent) {
                  fullContent = `Ошибка: ${data.v}`;
                } else {
                  fullContent += `\n\n_Ошибка: ${data.v}_`;
                }
                updateLastAssistantMessage(fullContent);
                break;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User stopped the stream
      } else {
        addMessage({
          id: crypto.randomUUID(),
          role: "ASSISTANT",
          content: "Ошибка подключения. Попробуйте позже.",
          createdAt: new Date().toISOString(),
        });
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setToolWorking(false);
    }
  }, [
    input,
    attachedFiles,
    isStreaming,
    messages,
    activeAgentId,
    thinkingEnabled,
    webSearchEnabled,
    addMessage,
    updateLastAssistantMessage,
    setStreaming,
    setStreamingPhase,
    setToolWorking,
  ]);

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
    setToolWorking(false);
  };

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

  const handleOpenTools = () => {
    setMenuOpen(false);
    setToolsOpen(true);
  };

  const handleAttachClick = () => {
    setMenuOpen(false);
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={CHAT_ACCEPTED_EXTENSIONS}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Active feature badges */}
      {activeFeatures.length > 0 && (
        <div className="flex items-center gap-1.5 px-2">
          {thinkingEnabled && (
            <button
              onClick={toggleThinking}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[10px] font-medium hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors cursor-pointer"
            >
              <Brain className="h-3 w-3" />
              Thinking
              <X className="h-2.5 w-2.5 ml-0.5" />
            </button>
          )}
          {webSearchEnabled && (
            <button
              onClick={toggleWebSearch}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer"
            >
              <Globe className="h-3 w-3" />
              Веб-поиск
              <X className="h-2.5 w-2.5 ml-0.5" />
            </button>
          )}
        </div>
      )}

      {/* Main input */}
      <div
        className={cn(
          "relative rounded-[32px] transition-all duration-300",
          "bg-surface border border-border",
          isFocused &&
            "shadow-[var(--shadow-input-focus)] border-transparent gradient-border"
        )}
      >
        {/* Attached files preview */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {attachedFiles.map((file) => (
              <div key={file.id} className="relative group">
                {file.preview ? (
                  <div className="h-16 w-16 rounded-lg overflow-hidden border border-border">
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-alt border border-border">
                    <FileText className="h-3.5 w-3.5 text-text-muted shrink-0" />
                    <span className="text-xs text-text-primary truncate max-w-[120px]">
                      {file.name}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => removeFile(file.id)}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-error text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 px-4 py-3">
          {/* Plus menu button */}
          <div className="relative">
            <button
              onClick={() => {
                setMenuOpen(!menuOpen);
                setToolsOpen(false);
              }}
              className={cn(
                "h-8 w-8 rounded-xl flex items-center justify-center transition-all shrink-0 mb-0.5 cursor-pointer",
                menuOpen
                  ? "text-accent bg-accent-light rotate-45"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-alt"
              )}
              title="Функции"
            >
              <Plus className="h-4.5 w-4.5 transition-transform" />
            </button>

            {/* Plus menu popover */}
            <AnimatePresence>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setMenuOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{
                      type: "spring",
                      damping: 25,
                      stiffness: 300,
                    }}
                    className="absolute bottom-full left-0 mb-2 z-40 w-[220px] bg-surface border border-border rounded-2xl shadow-xl overflow-hidden"
                  >
                    <div className="py-1.5">
                      {/* Attach file */}
                      <button
                        onClick={handleAttachClick}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                      >
                        <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-500 flex items-center justify-center">
                          <Paperclip className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 text-left">
                          <span>Прикрепить файл</span>
                          <p className="text-[10px] text-text-muted mt-0.5">
                            PNG, JPG, WebP, TXT, MD
                          </p>
                        </div>
                      </button>

                      {/* Legal tools */}
                      <button
                        onClick={handleOpenTools}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                      >
                        <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-500 flex items-center justify-center">
                          <Wrench className="h-3.5 w-3.5" />
                        </div>
                        <span>Юр. инструменты</span>
                      </button>

                      <div className="h-px bg-border mx-3 my-1" />

                      {/* Web Search toggle */}
                      <button
                        onClick={() => {
                          toggleWebSearch();
                          setMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                      >
                        <div
                          className={cn(
                            "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                            webSearchEnabled
                              ? "bg-emerald-500 text-white"
                              : "bg-emerald-50 dark:bg-emerald-950 text-emerald-500"
                          )}
                        >
                          <Globe className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 text-left">
                          <span>Веб-поиск</span>
                        </div>
                        <div
                          className={cn(
                            "w-8 h-4.5 rounded-full transition-colors relative",
                            webSearchEnabled ? "bg-emerald-500" : "bg-border"
                          )}
                        >
                          <div
                            className={cn(
                              "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all",
                              webSearchEnabled ? "left-[18px]" : "left-0.5"
                            )}
                          />
                        </div>
                      </button>

                      {/* Thinking toggle */}
                      <button
                        onClick={() => {
                          toggleThinking();
                          setMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                      >
                        <div
                          className={cn(
                            "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                            thinkingEnabled
                              ? "bg-violet-500 text-white"
                              : "bg-violet-50 dark:bg-violet-950 text-violet-500"
                          )}
                        >
                          <Brain className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 text-left">
                          <span>Thinking</span>
                        </div>
                        <div
                          className={cn(
                            "w-8 h-4.5 rounded-full transition-colors relative",
                            thinkingEnabled ? "bg-violet-500" : "bg-border"
                          )}
                        >
                          <div
                            className={cn(
                              "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all",
                              thinkingEnabled ? "left-[18px]" : "left-0.5"
                            )}
                          />
                        </div>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Legal tools panel (separate popover) */}
            <ToolsPanel
              isOpen={toolsOpen}
              onClose={() => setToolsOpen(false)}
            />
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
                onClick={handleStop}
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
                disabled={!input.trim() && attachedFiles.length === 0}
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer",
                  input.trim() || attachedFiles.length > 0
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
            Kimi K2.5 · Leema может ошибаться
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── File reading helpers ─────────────────────────────────

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
