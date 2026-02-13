"use client";

import { Scale, User, Copy, Check, RotateCcw, Brain, ChevronDown } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { LegalReference } from "./LegalReference";
import type { ChatMessage } from "@/types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
  isLast: boolean;
}

export function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const isUser = message.role === "USER";
  const isAssistant = message.role === "ASSISTANT";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("group flex gap-3 py-3", isUser && "flex-row-reverse")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
          isUser
            ? "bg-accent text-white"
            : "bg-gradient-to-br from-accent to-legal-ref text-white"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Scale className="h-4 w-4" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex-1 min-w-0 max-w-[85%]",
          isUser && "flex flex-col items-end"
        )}
      >
        {/* Name */}
        <span className="text-[11px] font-medium text-text-muted mb-1 block">
          {isUser ? "Вы" : "Leema"}
        </span>

        {/* Reasoning block */}
        {isAssistant && message.reasoning && (
          <div className="mb-2 w-full">
            <button
              onClick={() => setReasoningOpen(!reasoningOpen)}
              className="flex items-center gap-1.5 text-[11px] text-violet-500 hover:text-violet-600 transition-colors cursor-pointer mb-1"
            >
              <Brain className="h-3 w-3" />
              <span>Ход мысли</span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  reasoningOpen && "rotate-180"
                )}
              />
            </button>
            {reasoningOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 px-3 py-2 text-xs text-violet-700 dark:text-violet-300 leading-relaxed max-h-[300px] overflow-y-auto"
              >
                <pre className="whitespace-pre-wrap font-sans">
                  {message.reasoning}
                </pre>
              </motion.div>
            )}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-accent text-white rounded-tr-md"
              : "bg-surface-alt text-text-primary rounded-tl-md border border-border"
          )}
        >
          {isAssistant ? (
            <div className="prose-leema">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0">{children}</p>
                  ),
                  code: ({ className, children, ...props }) => {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code className="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 text-[13px] font-mono">
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code className={cn("text-[13px]", className)} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* Legal References */}
        {message.legalRefs && message.legalRefs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.legalRefs.map((ref) => (
              <LegalReference key={ref.id} reference={ref} />
            ))}
          </div>
        )}

        {/* Actions */}
        {isAssistant && (
          <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="h-6 px-2 rounded-md text-[10px] text-text-muted hover:text-text-primary hover:bg-surface-alt flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copied ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Скопировано" : "Копировать"}
            </button>
            <button className="h-6 px-2 rounded-md text-[10px] text-text-muted hover:text-text-primary hover:bg-surface-alt flex items-center gap-1 transition-colors cursor-pointer">
              <RotateCcw className="h-3 w-3" />
              Повторить
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
