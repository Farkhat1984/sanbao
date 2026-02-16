"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Send,
  StopCircle,
  Plus,
  Paperclip,
  Wrench,
  Globe,
  Brain,
  ListChecks,
  Mic,
  X,
  FileText,
  Image as ImageIcon,
  Loader2,
  Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { useTaskStore } from "@/stores/taskStore";
import dynamic from "next/dynamic";
import { ToolsPanel } from "@/components/legal-tools/ToolsPanel";
import { AlertModal } from "@/components/ui/AlertModal";
import { openArtifactInPanel } from "@/lib/panel-actions";

const ImageGenerateModal = dynamic(
  () => import("@/components/image-edit/ImageGenerateModal").then((m) => m.ImageGenerateModal),
  { ssr: false }
);
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/stores/agentStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MAX_FILE_SIZE_PARSE, DEFAULT_PROVIDER } from "@/lib/constants";

const CHAT_ACCEPTED_EXTENSIONS =
  ".png,.jpg,.jpeg,.webp,.txt,.md,.pdf,.docx,.doc,.xlsx,.xls,.csv,.html,.htm,.pptx,.rtf";
const CHAT_MAX_FILE_SIZE = MAX_FILE_SIZE_PARSE;

interface AttachedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  base64?: string;
  preview?: string;
  textContent?: string;
  isParsing?: boolean;
}

// ─── SpeechRecognition type for TS ──────────────────────

type SpeechRecognitionType = typeof window extends { SpeechRecognition: infer T }
  ? T
  : // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any;

function getSpeechRecognition(): SpeechRecognitionType | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

// ─── Document type helpers ──────────────────────────────

const DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/rtf",
  "text/html",
];

const DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".pptx", ".rtf", ".html", ".htm"];

function isDocumentFile(file: File): boolean {
  if (DOCUMENT_TYPES.includes(file.type)) return true;
  return DOCUMENT_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  );
}

export function MessageInput() {
  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [imageGenOpen, setImageGenOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ title: string; description?: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const {
    messages,
    isStreaming,
    activeConversationId,
    activeAgentId,
    thinkingEnabled,
    webSearchEnabled,
    planningEnabled,
    pendingInput,
    addMessage,
    addConversation,
    setActiveConversation,
    updateLastAssistantMessage,
    setStreaming,
    setStreamingPhase,
    toggleThinking,
    toggleWebSearch,
    togglePlanning,
    updateCurrentPlan,
    setCurrentPlan,
    setContextUsage,
    setPendingInput,
    setClarifyQuestions,
  } = useChatStore();

  const { addTask } = useTaskStore();
  const { agentTools } = useAgentStore();
  const isMobile = useIsMobile();

  // Detect speech support on client only (avoid hydration mismatch)
  const [hasSpeechSupport, setHasSpeechSupport] = useState(false);
  useEffect(() => {
    setHasSpeechSupport(!!getSpeechRecognition());
  }, []);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  // ─── Voice recording ──────────────────────────────────────

  const startRecording = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.interimResults = true;
    recognition.continuous = true;

    let finalTranscript = "";

    recognition.onresult = (event: { resultIndex: number; results: { length: number; [key: number]: { isFinal: boolean; [key: number]: { transcript: string } } } }) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim = transcript;
        }
      }
      setInput(finalTranscript + interim);
    };

    recognition.onerror = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
      // Auto-resize textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height =
          Math.min(textareaRef.current.scrollHeight, 200) + "px";
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // ─── File handling ───────────────────────────────────────

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      for (const file of Array.from(files)) {
        if (file.size > CHAT_MAX_FILE_SIZE) {
          setAlertMessage({ title: "Файл слишком большой", description: `«${file.name}» превышает лимит 20 МБ` });
          continue;
        }

        const isImage = file.type.startsWith("image/");
        const isText =
          file.type === "text/plain" || file.type === "text/csv" ||
          file.name.endsWith(".md") || file.name.endsWith(".csv");
        const isDocument = isDocumentFile(file);

        if (!isImage && !isText && !isDocument) {
          setAlertMessage({ title: "Формат не поддерживается", description: `«${file.name}» — поддерживаются PNG, JPG, WebP, TXT, MD, CSV, PDF, DOCX, XLSX, PPTX, RTF, HTML` });
          continue;
        }

        const attached: AttachedFile = {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type || (file.name.endsWith(".md") ? "text/plain" : file.name.endsWith(".csv") ? "text/csv" : ""),
          size: file.size,
        };

        if (isImage) {
          const dataUrl = await readFileAsDataUrl(file);
          attached.preview = dataUrl;
          attached.base64 = dataUrl.split(",")[1];
          setAttachedFiles((prev) => [...prev, attached]);
        } else if (isText) {
          attached.textContent = await readFileAsText(file);
          setAttachedFiles((prev) => [...prev, attached]);
        } else if (isDocument) {
          // Parse document server-side
          attached.isParsing = true;
          setAttachedFiles((prev) => [...prev, attached]);

          try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/files/parse", {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              const err = await response.json().catch(() => ({ error: "Ошибка" }));
              throw new Error(err.error || "Не удалось обработать файл");
            }

            const { text } = await response.json();
            setAttachedFiles((prev) =>
              prev.map((f) =>
                f.id === attached.id
                  ? { ...f, textContent: text, isParsing: false }
                  : f
              )
            );
          } catch (err) {
            setAlertMessage({ title: "Ошибка обработки файла", description: `«${file.name}»: ${err instanceof Error ? err.message : "Неизвестная ошибка"}` });
            setAttachedFiles((prev) => prev.filter((f) => f.id !== attached.id));
          }
        }
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    []
  );

  const removeFile = useCallback((id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // ─── Auto-submit from tools/templates ────────────────────

  useEffect(() => {
    if (pendingInput && !isStreaming) {
      const input = pendingInput;
      setPendingInput(null);
      doSubmit(input);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInput]);

  // ─── Submit ──────────────────────────────────────────────

  const doSubmit = useCallback(async (overrideInput?: string) => {
    const trimmed = (overrideInput ?? input).trim();
    if ((!trimmed && attachedFiles.length === 0) || isStreaming) return;
    // Don't submit while files are parsing
    if (attachedFiles.some((f) => f.isParsing)) return;

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
    setCurrentPlan(null);
    // Phase is null — will be determined by the first stream chunk

    // Ensure we have a conversation for persistence
    let convId = activeConversationId;
    if (!convId) {
      try {
        const convRes = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmed.slice(0, 60) || "Новый чат",
            agentId: activeAgentId || undefined,
          }),
        });
        if (convRes.ok) {
          const conv = await convRes.json();
          convId = conv.id;
          addConversation(conv);
          setActiveConversation(conv.id);
          window.history.replaceState(null, "", `/chat/${conv.id}`);
        } else if (convRes.status === 403) {
          const err = await convRes.json().catch(() => ({ error: "Лимит диалогов" }));
          addMessage({
            id: crypto.randomUUID(),
            role: "ASSISTANT",
            content: `Ошибка: ${err.error}`,
            createdAt: new Date().toISOString(),
          });
          setStreaming(false);
          return;
        }
      } catch {
        // Continue without persistence if conversation creation fails
      }
    }

    let fullContent = "";
    let fullPlan = "";

    try {
      const apiMessages = [...messages, userMessage]
        .filter((m) => m.content.trim() !== "")
        .map((m) => ({
          role: m.role.toLowerCase(),
          content: m.content,
        }));

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
          provider: DEFAULT_PROVIDER,
          agentId: activeAgentId,
          conversationId: convId,
          thinkingEnabled,
          webSearchEnabled,
          planningEnabled,
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
      if (!response.body) {
        setStreaming(false);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
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
                setStreamingPhase("thinking");
                fullReasoning += data.v;
                updateLastAssistantMessage(fullContent, fullReasoning);
                break;
              case "s": // status (searching / using_tool)
                setStreamingPhase(data.v === "using_tool" ? "using_tool" : "searching");
                break;
              case "c": // content
                setStreamingPhase("answering");
                fullContent += data.v;
                updateLastAssistantMessage(
                  fullContent,
                  fullReasoning || undefined
                );
                break;
              case "p": // plan content
                setStreamingPhase("planning");
                fullPlan += data.v;
                updateCurrentPlan(data.v);
                updateLastAssistantMessage(
                  fullContent,
                  fullReasoning || undefined,
                  fullPlan
                );
                break;
              case "x": // context info
                try {
                  const info = JSON.parse(data.v);
                  if (info.action === "context_info") {
                    setContextUsage({
                      usagePercent: info.usagePercent,
                      totalTokens: info.totalTokens,
                      contextWindowSize: info.contextWindowSize,
                      isCompacting: info.compacting,
                    });
                  }
                } catch {
                  // ignore malformed context info
                }
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

      // Save messages to DB after stream completes
      if (convId && fullContent) {
        fetch(`/api/conversations/${convId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "USER", content: trimmed },
              { role: "ASSISTANT", content: fullContent, planContent: fullPlan || undefined },
            ],
          }),
        }).catch(console.error);
      }

      // Detect and create tasks from <sanbao-task> tags
      const taskRegex = /<sanbao-task\s+title="([^"]+)">([\s\S]*?)<\/sanbao-task>/g;
      let taskMatch;
      while ((taskMatch = taskRegex.exec(fullContent)) !== null) {
        const taskTitle = taskMatch[1];
        const taskBody = taskMatch[2];
        const steps = taskBody
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("- ["))
          .map((line) => ({
            text: line.replace(/^- \[[ x]\]\s*/, ""),
            done: line.includes("[x]"),
          }));

        if (steps.length > 0) {
          fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: taskTitle,
              steps,
              conversationId: convId,
            }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((task) => {
              if (task) addTask(task);
            })
            .catch(console.error);
        }
      }

      // Auto-open first artifact
      const docMatch = /<sanbao-doc\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/sanbao-doc>/.exec(fullContent);
      if (docMatch) {
        openArtifactInPanel({
          id: crypto.randomUUID(),
          type: docMatch[1] as import("@/types/chat").ArtifactType,
          title: docMatch[2],
          content: docMatch[3].trim(),
          version: 1,
        });
      }

      // Detect clarify questions from <sanbao-clarify> tag
      const clarifyMatch = /<sanbao-clarify>([\s\S]*?)<\/sanbao-clarify>/.exec(fullContent);
      if (clarifyMatch) {
        try {
          const questions = JSON.parse(clarifyMatch[1]);
          if (Array.isArray(questions) && questions.length > 0) {
            setClarifyQuestions(questions);
          }
        } catch {
          // Skip malformed clarify JSON
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User stopped the stream — save partial content if available
        if (convId && fullContent) {
          fetch(`/api/conversations/${convId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [
                { role: "USER", content: trimmed },
                { role: "ASSISTANT", content: fullContent, planContent: fullPlan || undefined },
              ],
            }),
          }).catch(console.error);
        }
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
    }
  }, [
    input,
    attachedFiles,
    isStreaming,
    messages,
    activeConversationId,
    activeAgentId,
    thinkingEnabled,
    webSearchEnabled,
    planningEnabled,
    addMessage,
    addConversation,
    setActiveConversation,
    updateLastAssistantMessage,
    setStreaming,
    setStreamingPhase,
    updateCurrentPlan,
    setCurrentPlan,
    setContextUsage,
    addTask,
    setPendingInput,
    setClarifyQuestions,
  ]);

  const handleSubmit = useCallback(() => {
    doSubmit();
  }, [doSubmit]);

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
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
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const handleOpenTools = () => {
    setMenuOpen(false);
    setToolsOpen(true);
  };

  const handleAttachClick = () => {
    setMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleCameraClick = () => {
    setMenuOpen(false);
    cameraInputRef.current?.click();
  };

  const hasContent = input.trim() || attachedFiles.length > 0;
  const hasParsing = attachedFiles.some((f) => f.isParsing);

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
      {/* Hidden camera input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Active feature badges */}
      <div className="flex items-center gap-1.5 flex-wrap px-2">
        {thinkingEnabled && (
          <button
            onClick={toggleThinking}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-medium hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors cursor-pointer",
              isMobile ? "text-xs py-1" : "text-[10px]"
            )}
          >
            <Brain className="h-3 w-3" />
            Thinking
            <X className="h-2.5 w-2.5 ml-0.5" />
          </button>
        )}
        {webSearchEnabled && (
          <button
            onClick={toggleWebSearch}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer",
              isMobile ? "text-xs py-1" : "text-[10px]"
            )}
          >
            <Globe className="h-3 w-3" />
            Веб-поиск
            <X className="h-2.5 w-2.5 ml-0.5" />
          </button>
        )}
        {planningEnabled && (
          <button
            onClick={togglePlanning}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors cursor-pointer",
              isMobile ? "text-xs py-1" : "text-[10px]"
            )}
          >
            <ListChecks className="h-3 w-3" />
            Планирование
            <X className="h-2.5 w-2.5 ml-0.5" />
          </button>
        )}
      </div>

      {/* Main input */}
      <div
        data-tour="chat-input"
        className={cn(
          "relative rounded-[32px] transition-all duration-300",
          "bg-surface gradient-border-animated",
          isFocused && "shadow-[var(--shadow-input-focus)] gradient-border-focused"
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
                    {file.isParsing ? (
                      <Loader2 className="h-3.5 w-3.5 text-accent shrink-0 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-text-muted shrink-0" />
                    )}
                    <span className="text-xs text-text-primary truncate max-w-[120px]">
                      {file.name}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => removeFile(file.id)}
                  className={cn(
                    "absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-error text-white flex items-center justify-center transition-opacity cursor-pointer",
                    isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 px-4 py-3">
          {/* Plus menu button */}
          <div className="relative" data-tour="plus-menu">
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
                            PDF, DOCX, XLSX, PPTX, CSV, HTML, RTF, PNG
                          </p>
                        </div>
                      </button>

                      {/* Camera */}
                      <button
                        onClick={handleCameraClick}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                      >
                        <div className="h-7 w-7 rounded-lg bg-green-50 dark:bg-green-950 text-green-500 flex items-center justify-center">
                          <Camera className="h-3.5 w-3.5" />
                        </div>
                        <span>Сделать фото</span>
                      </button>

                      {/* Agent tools (shown when agent has PROMPT_TEMPLATE tools) */}
                      {agentTools.length > 0 && (
                        <button
                          onClick={handleOpenTools}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                        >
                          <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-500 flex items-center justify-center">
                            <Wrench className="h-3.5 w-3.5" />
                          </div>
                          <span>Инструменты</span>
                        </button>
                      )}

                      {/* Image generation */}
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setImageGenOpen(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                      >
                        <div className="h-7 w-7 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-500 flex items-center justify-center">
                          <ImageIcon className="h-3.5 w-3.5" />
                        </div>
                        <span>Генерация картинок</span>
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

                      {/* Planning toggle */}
                      <button
                        onClick={() => {
                          togglePlanning();
                          setMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                      >
                        <div
                          className={cn(
                            "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                            planningEnabled
                              ? "bg-amber-500 text-white"
                              : "bg-amber-50 dark:bg-amber-950 text-amber-500"
                          )}
                        >
                          <ListChecks className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 text-left">
                          <span>Планирование</span>
                        </div>
                        <div
                          className={cn(
                            "w-8 h-4.5 rounded-full transition-colors relative",
                            planningEnabled ? "bg-amber-500" : "bg-border"
                          )}
                        >
                          <div
                            className={cn(
                              "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all",
                              planningEnabled ? "left-[18px]" : "left-0.5"
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
            placeholder={
              isRecording
                ? "Говорите..."
                : "Напишите сообщение..."
            }
            rows={1}
            className={cn(
              "flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none leading-relaxed max-h-[120px] overflow-y-auto py-1",
              isRecording && "placeholder:text-red-400"
            )}
          />

          {/* Send / Stop / Mic button */}
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
            ) : isRecording ? (
              <motion.button
                key="mic-active"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={stopRecording}
                className="relative h-9 w-9 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shrink-0 cursor-pointer"
              >
                <motion.div
                  className="absolute inset-0 rounded-full bg-red-500"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <Mic className="h-4 w-4 relative z-10" />
              </motion.button>
            ) : hasContent ? (
              <motion.button
                key="send"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={handleSubmit}
                disabled={hasParsing}
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer",
                  hasParsing
                    ? "bg-surface-alt text-text-muted"
                    : "bg-gradient-to-r from-accent to-legal-ref text-white shadow-md hover:shadow-lg"
                )}
              >
                {hasParsing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </motion.button>
            ) : hasSpeechSupport ? (
              <motion.button
                key="mic"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={startRecording}
                className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer bg-surface-alt text-text-muted hover:text-text-primary hover:bg-surface-alt/80"
              >
                <Mic className="h-4 w-4" />
              </motion.button>
            ) : (
              <motion.button
                key="send-disabled"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                disabled
                className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 bg-surface-alt text-text-muted"
              >
                <Send className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom hint */}
        <div className="px-5 pb-2 flex items-center justify-between">
          {!isMobile && (
            <span className="text-[10px] text-text-muted">
              {isRecording
                ? "Нажмите на микрофон чтобы остановить"
                : "Enter — отправить, Shift+Enter — новая строка"}
            </span>
          )}
          <span className={cn("text-[10px] text-text-muted", isMobile && "ml-auto")}>
            Kimi K2.5 · Sanbao может ошибаться
          </span>
        </div>
      </div>

      {/* Image generate modal */}
      <ImageGenerateModal
        isOpen={imageGenOpen}
        onClose={() => setImageGenOpen(false)}
      />

      {/* File error alert */}
      <AlertModal
        isOpen={!!alertMessage}
        onClose={() => setAlertMessage(null)}
        title={alertMessage?.title || ""}
        description={alertMessage?.description}
      />
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
