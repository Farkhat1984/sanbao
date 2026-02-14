"use client";

import {
  Scale,
  User,
  Copy,
  Check,
  RotateCcw,
  Brain,
  ChevronDown,
  FileText,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { LegalReference } from "./LegalReference";
import { PlanBlock } from "./PlanBlock";
import { useArtifactStore } from "@/stores/artifactStore";
import type { ChatMessage, ArtifactType } from "@/types/chat";

// ─── Artifact parsing ────────────────────────────────────

const ARTIFACT_REGEX =
  /<leema-doc\s+type="(\w+)"\s+title="([^"]*)">([\s\S]*?)<\/leema-doc>/g;

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  CONTRACT: "Договор",
  CLAIM: "Иск",
  COMPLAINT: "Жалоба",
  DOCUMENT: "Документ",
  CODE: "Код",
  ANALYSIS: "Анализ",
  IMAGE: "Изображение",
};

interface ParsedPart {
  type: "text" | "artifact";
  content: string;
  artifactType?: string;
  title?: string;
}

function parseContentWithArtifacts(content: string): ParsedPart[] {
  const parts: ParsedPart[] = [];
  let lastIndex = 0;
  let match;

  ARTIFACT_REGEX.lastIndex = 0;
  while ((match = ARTIFACT_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
    }
    parts.push({
      type: "artifact",
      artifactType: match[1],
      title: match[2],
      content: match[3].trim(),
    });
    lastIndex = ARTIFACT_REGEX.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }

  return parts;
}

// ─── Markdown renderer ───────────────────────────────────

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0">{children}</p>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent hover:underline inline-flex items-center gap-0.5"
    >
      {children}
    </a>
  ),
  code: ({
    className,
    children,
    ...props
  }: {
    className?: string;
    children?: React.ReactNode;
  }) => {
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
};

// ─── Component ───────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage;
  isLast: boolean;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const { openArtifact } = useArtifactStore();
  const isUser = message.role === "USER";
  const isAssistant = message.role === "ASSISTANT";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse artifacts from assistant messages
  const parts = isAssistant ? parseContentWithArtifacts(message.content) : [];
  const hasArtifacts = parts.some((p) => p.type === "artifact");

  const handleOpenArtifact = (part: ParsedPart) => {
    openArtifact({
      id: crypto.randomUUID(),
      type: (part.artifactType || "DOCUMENT") as ArtifactType,
      title: part.title || "Документ",
      content: part.content,
      version: 1,
    });
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

        {/* Plan block */}
        {isAssistant && message.planContent && (
          <PlanBlock content={message.planContent} />
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
              {hasArtifacts ? (
                // Render with inline artifact cards
                parts.map((part, i) =>
                  part.type === "text" ? (
                    part.content.trim() ? (
                      <ReactMarkdown
                        key={i}
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {part.content}
                      </ReactMarkdown>
                    ) : null
                  ) : (
                    <button
                      key={i}
                      onClick={() => handleOpenArtifact(part)}
                      className="my-2 w-full flex items-center gap-3 p-3 rounded-xl bg-surface border border-border hover:border-accent hover:shadow-sm transition-all cursor-pointer text-left group/artifact"
                    >
                      <div className="h-10 w-10 rounded-lg bg-accent-light flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {part.title}
                        </p>
                        <p className="text-xs text-text-muted">
                          {ARTIFACT_TYPE_LABELS[part.artifactType || ""] ||
                            part.artifactType}{" "}
                          &middot; Нажмите чтобы открыть
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-text-muted group-hover/artifact:text-accent transition-colors shrink-0" />
                    </button>
                  )
                )
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {message.content}
                </ReactMarkdown>
              )}
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
