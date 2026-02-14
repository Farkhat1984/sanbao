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
  Pencil,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { LegalReference } from "./LegalReference";
import { PlanBlock } from "./PlanBlock";
import { useArtifactStore } from "@/stores/artifactStore";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";
import type { ChatMessage, ArtifactType } from "@/types/chat";

// ─── Artifact parsing ────────────────────────────────────

const CLARIFY_REGEX = /<leema-clarify>[\s\S]*?<\/leema-clarify>/g;

const ARTIFACT_REGEX =
  /<leema-doc\s+type="(\w+)"\s+title="([^"]*)">([\s\S]*?)<\/leema-doc>/g;

const EDIT_REGEX =
  /<leema-edit\s+target="([^"]*)">([\s\S]*?)<\/leema-edit>/g;

const REPLACE_REGEX =
  /<replace>\s*<old>([\s\S]*?)<\/old>\s*<new>([\s\S]*?)<\/new>\s*<\/replace>/g;

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
  type: "text" | "artifact" | "edit";
  content: string;
  artifactType?: string;
  title?: string;
  edits?: Array<{ old: string; new: string }>;
}

function parseContentWithArtifacts(rawContent: string): ParsedPart[] {
  const content = rawContent.replace(CLARIFY_REGEX, "").trim();
  const parts: ParsedPart[] = [];
  let lastIndex = 0;

  // Combine both regexes — find all matches sorted by position
  const allMatches: Array<{
    index: number;
    end: number;
    part: ParsedPart;
  }> = [];

  // Find artifacts
  ARTIFACT_REGEX.lastIndex = 0;
  let match;
  while ((match = ARTIFACT_REGEX.exec(content)) !== null) {
    allMatches.push({
      index: match.index,
      end: ARTIFACT_REGEX.lastIndex,
      part: {
        type: "artifact",
        artifactType: match[1],
        title: match[2],
        content: match[3].trim(),
      },
    });
  }

  // Find edits
  EDIT_REGEX.lastIndex = 0;
  while ((match = EDIT_REGEX.exec(content)) !== null) {
    const target = match[1];
    const editBody = match[2];
    const edits: Array<{ old: string; new: string }> = [];

    REPLACE_REGEX.lastIndex = 0;
    let replaceMatch;
    while ((replaceMatch = REPLACE_REGEX.exec(editBody)) !== null) {
      edits.push({ old: replaceMatch[1].trim(), new: replaceMatch[2].trim() });
    }

    if (edits.length > 0) {
      allMatches.push({
        index: match.index,
        end: EDIT_REGEX.lastIndex,
        part: {
          type: "edit",
          title: target,
          content: "",
          edits,
        },
      });
    }
  }

  // Sort by position
  allMatches.sort((a, b) => a.index - b.index);

  for (const m of allMatches) {
    if (m.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, m.index) });
    }
    parts.push(m.part);
    lastIndex = m.end;
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
  agentName?: string;
  agentIcon?: string;
  agentIconColor?: string;
}

export function MessageBubble({ message, agentName, agentIcon, agentIconColor }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const { openArtifact, trackArtifact, findByTitle, applyEdits } = useArtifactStore();
  const isUser = message.role === "USER";
  const isAssistant = message.role === "ASSISTANT";

  // Track which edits we've already applied (by message id)
  const appliedEditsRef = useRef<Set<string>>(new Set());

  // Collapse long assistant messages
  const [isExpanded, setIsExpanded] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    if (!isAssistant || isExpanded) return;
    const el = bubbleRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      setIsOverflowing(el.scrollHeight > 500);
    });
  }, [message.content, isAssistant, isExpanded]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse artifacts and edits from assistant messages
  const parts = isAssistant ? parseContentWithArtifacts(message.content) : [];
  const hasSpecialParts = parts.some((p) => p.type === "artifact" || p.type === "edit");

  // Auto-apply edits to existing artifacts (run once per message)
  useEffect(() => {
    if (!isAssistant) return;

    const editParts = parts.filter((p) => p.type === "edit");
    for (const part of editParts) {
      const editKey = `${message.id}-${part.title}`;
      if (appliedEditsRef.current.has(editKey)) continue;
      appliedEditsRef.current.add(editKey);

      const target = findByTitle(part.title || "");
      if (target && part.edits) {
        applyEdits(target.id, part.edits);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, message.content]);

  const handleOpenArtifact = (part: ParsedPart) => {
    // Reuse existing artifact if already tracked (prevents version increment on re-click)
    const existing = findByTitle(part.title || "");
    if (existing) {
      openArtifact(existing);
      return;
    }

    const artifact = {
      id: crypto.randomUUID(),
      type: (part.artifactType || "DOCUMENT") as ArtifactType,
      title: part.title || "Документ",
      content: part.content,
      version: 1,
    };
    openArtifact(artifact);
  };

  const handleOpenEditedArtifact = (title: string) => {
    const target = findByTitle(title);
    if (target) {
      openArtifact(target);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("group flex gap-3 py-3", isUser && "flex-row-reverse")}
    >
      {/* Avatar */}
      {(() => {
        const AgentIcon = agentIcon ? (ICON_MAP[agentIcon] || Scale) : Scale;
        return (
          <div
            className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
              isUser
                ? "bg-accent text-white"
                : !agentIconColor && "bg-gradient-to-br from-accent to-legal-ref text-white"
            )}
            style={!isUser && agentIconColor ? { backgroundColor: agentIconColor, color: "white" } : undefined}
          >
            {isUser ? (
              <User className="h-4 w-4" />
            ) : (
              <AgentIcon className="h-4 w-4" />
            )}
          </div>
        );
      })()}

      {/* Content */}
      <div
        className={cn(
          "flex-1 min-w-0 max-w-[85%]",
          isUser && "flex flex-col items-end"
        )}
      >
        {/* Name */}
        <span className="text-[11px] font-medium text-text-muted mb-1 block">
          {isUser ? "Вы" : (agentName || "Leema")}
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
          ref={isAssistant ? bubbleRef : undefined}
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-accent text-white rounded-tr-md"
              : "bg-surface-alt text-text-primary rounded-tl-md border border-border",
            isAssistant && !isExpanded && "max-h-[500px] overflow-auto relative",
            isAssistant && isExpanded && "max-h-[80vh] overflow-auto"
          )}
        >
          {isAssistant ? (
            <div className="prose-leema">
              {hasSpecialParts ? (
                // Render with inline artifact/edit cards
                parts.map((part, i) => {
                  if (part.type === "text") {
                    return part.content.trim() ? (
                      <ReactMarkdown
                        key={i}
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {part.content}
                      </ReactMarkdown>
                    ) : null;
                  }

                  if (part.type === "artifact") {
                    return (
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
                    );
                  }

                  if (part.type === "edit") {
                    const target = findByTitle(part.title || "");
                    return (
                      <button
                        key={i}
                        onClick={() => handleOpenEditedArtifact(part.title || "")}
                        className="my-2 w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 hover:shadow-sm transition-all cursor-pointer text-left group/edit"
                      >
                        <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                          <Pencil className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {part.title}
                          </p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">
                            {part.edits?.length} {part.edits?.length === 1 ? "изменение" : "изменений"}
                            {target ? ` · v${target.version}` : ""}
                            {" "}&middot; Нажмите чтобы открыть
                          </p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-text-muted group-hover/edit:text-emerald-500 transition-colors shrink-0" />
                      </button>
                    );
                  }

                  return null;
                })
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {message.content.replace(CLARIFY_REGEX, "").trim()}
                </ReactMarkdown>
              )}
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}

          {/* Shadow hint for collapsed scrollable messages */}
          {isAssistant && !isExpanded && isOverflowing && (
            <div className="sticky bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-surface-alt to-transparent pointer-events-none" />
          )}
        </div>

        {/* Expand / Collapse */}
        {isAssistant && isOverflowing && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 mt-1.5 text-xs text-text-muted hover:text-accent transition-colors cursor-pointer"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
            {isExpanded ? "Свернуть" : "Развернуть"}
          </button>
        )}

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
