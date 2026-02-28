"use client";

import { useState, useRef, useCallback } from "react";
import {
  Send,
  StopCircle,
  Globe,
  Brain,
  Mic,
  X,
  FileText,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import dynamic from "next/dynamic";
import { AlertModal } from "@/components/ui/AlertModal";
import { PlusMenu } from "@/components/chat/PlusMenu";

const ImageGenerateModal = dynamic(
  () => import("@/components/image-edit/ImageGenerateModal").then((m) => m.ImageGenerateModal),
  { ssr: false }
);
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/stores/agentStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useFileAttachment } from "@/hooks/useFileAttachment";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { useStreamChat } from "@/hooks/useStreamChat";

export function MessageInput() {
  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [imageGenOpen, setImageGenOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    isStreaming,
    thinkingEnabled,
    webSearchEnabled,
    toggleThinking,
    toggleWebSearch,
  } = useChatStore();

  const { agentTools } = useAgentStore();
  const isMobile = useIsMobile();

  // ─── Extracted hooks ────────────────────────────────────

  const {
    files: attachedFiles,
    addFiles: handleFileSelect,
    removeFile,
    clearFiles,
    fileInputRef,
    cameraInputRef,
    alertMessage,
    setAlertMessage,
    acceptedExtensions,
  } = useFileAttachment();

  const {
    isRecording,
    hasSpeechSupport,
    startRecording,
    stopRecording,
  } = useVoiceRecording({ setInput, textareaRef });

  const { doSubmit, handleStop } = useStreamChat({
    input,
    setInput,
    attachedFiles,
    clearFiles,
    textareaRef,
  });

  // ─── Handlers ───────────────────────────────────────────

  const handleSubmit = useCallback(() => {
    doSubmit();
  }, [doSubmit]);

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

  const hasContent = input.trim() || attachedFiles.length > 0;
  const hasParsing = attachedFiles.some((f) => f.isParsing);

  return (
    <div className="space-y-2">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedExtensions}
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
              "flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium hover:bg-violet-200 transition-colors cursor-pointer",
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
              "flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 font-medium hover:bg-emerald-200 transition-colors cursor-pointer",
              isMobile ? "text-xs py-1" : "text-[10px]"
            )}
          >
            <Globe className="h-3 w-3" />
            Веб-поиск
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
          {/* Plus menu */}
          <PlusMenu
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            toolsOpen={toolsOpen}
            setToolsOpen={setToolsOpen}
            onAttachClick={() => fileInputRef.current?.click()}
            onCameraClick={() => cameraInputRef.current?.click()}
            onImageGenOpen={() => setImageGenOpen(true)}
            hasAgentTools={agentTools.length > 0}
            webSearchEnabled={webSearchEnabled}
            thinkingEnabled={thinkingEnabled}
            toggleWebSearch={toggleWebSearch}
            toggleThinking={toggleThinking}
          />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            aria-label="Введите сообщение"
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
                aria-label="Остановить генерацию"
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
                aria-label="Остановить запись"
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
                aria-label="Отправить сообщение"
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
                aria-label="Начать запись голоса"
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
            Sanbao AI
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
