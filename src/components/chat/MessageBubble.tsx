"use client";

import {
  Triangle,
  User,
  Copy,
  Check,
  RotateCcw,
  Brain,
  ChevronDown,
  FileText,
  ExternalLink,
  Pencil,
  Image,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { LegalReference } from "./LegalReference";
import { ArticleLink } from "./ArticleLink";
import { PlanBlock } from "./PlanBlock";
import { useArtifactStore } from "@/stores/artifactStore";
import { openArtifactInPanel, openImageInPanel } from "@/lib/panel-actions";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ARTIFACT_TYPE_LABELS } from "@/lib/constants";
import type { ChatMessage, ArtifactType } from "@/types/chat";

// ─── Artifact parsing ────────────────────────────────────

const CLARIFY_REGEX = /<sanbao-clarify>[\s\S]*?<\/sanbao-clarify>/g;

const ARTIFACT_REGEX =
  /<sanbao-doc\s+type="(\w+)"\s+title="([^"]*)">([\s\S]*?)<\/sanbao-doc>/g;

const EDIT_REGEX =
  /<sanbao-edit\s+target="([^"]*)">([\s\S]*?)<\/sanbao-edit>/g;

const REPLACE_REGEX =
  /<replace>\s*<old>([\s\S]*?)<\/old>\s*<new>([\s\S]*?)<\/new>\s*<\/replace>/g;

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

/** Allow article:// protocol through URL sanitization */
function urlTransform(url: string): string {
  if (url.startsWith("article://")) return url;
  return defaultUrlTransform(url);
}

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0">{children}</p>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="table-wrapper">
      <table>{children}</table>
    </div>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    // article://criminal_code/188 → clickable ArticleLink (internal panel)
    if (href?.startsWith("article://")) {
      const raw = href.replace("article://", "").replace(/\/+$/, ""); // strip trailing slashes
      const slashIdx = raw.indexOf("/");
      const code = slashIdx > 0 ? raw.slice(0, slashIdx) : raw;
      const article = slashIdx > 0 ? raw.slice(slashIdx + 1) : "";
      if (code && article) {
        return <ArticleLink code={code} article={article}>{children}</ArticleLink>;
      }
      // Malformed article:// (no article number) — render as plain text, never <a>
      return <span className="text-legal-ref font-medium">§ {children}</span>;
    }
    // External links → open in new browser tab
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent hover:underline inline-flex items-center gap-0.5"
      >
        {children}
        <ExternalLink className="h-3 w-3 inline shrink-0 opacity-40" />
      </a>
    );
  },
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <button
      type="button"
      onClick={() => typeof props.src === "string" && openImageInPanel(props.src, String(props.alt || ""))}
      className="my-2 flex items-center gap-3 p-2.5 rounded-xl bg-surface border border-border hover:border-accent hover:shadow-sm transition-all cursor-pointer text-left group/img"
    >
      <div className="h-10 w-10 rounded-lg bg-accent-light flex items-center justify-center shrink-0">
        <Image className="h-5 w-5 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{props.alt || "Изображение"}</p>
        <p className="text-xs text-text-muted">Нажмите чтобы открыть</p>
      </div>
      <ExternalLink className="h-4 w-4 text-text-muted group-hover/img:text-accent transition-colors shrink-0" />
    </button>
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
        <code className="bg-black/10 rounded px-1 py-0.5 text-[13px] font-mono">
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
  onRetry?: (messageId: string) => void;
}

export function MessageBubble({ message, agentName, agentIcon, agentIconColor, onRetry }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const { trackArtifact, findByTitle, applyEdits } = useArtifactStore();
  const isMobile = useIsMobile();
  const isUser = message.role === "USER";
  const isAssistant = message.role === "ASSISTANT";

  // Track which edits we've already applied (by message id)
  const appliedEditsRef = useRef<Set<string>>(new Set());

  // Collapse long assistant messages
  const [isExpanded, setIsExpanded] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // Collapse long user messages (~20 lines ≈ 400px)
  const [isUserExpanded, setIsUserExpanded] = useState(false);
  const userBubbleRef = useRef<HTMLDivElement>(null);
  const [isUserOverflowing, setIsUserOverflowing] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse artifacts and edits from assistant messages (memoized — regex parsing is expensive)
  const parts = useMemo(
    () => (isAssistant ? parseContentWithArtifacts(message.content) : []),
    [isAssistant, message.content]
  );
  const hasSpecialParts = useMemo(
    () => parts.some((p) => p.type === "artifact" || p.type === "edit"),
    [parts]
  );

  // Detect overflow for assistant messages
  useEffect(() => {
    if (!isAssistant || isExpanded) return;
    const el = bubbleRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      setIsOverflowing(el.scrollHeight > 500);
    });
  }, [message.content, isAssistant, isExpanded]);

  // Detect overflow for user messages
  useEffect(() => {
    if (!isUser || isUserExpanded) return;
    const el = userBubbleRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      setIsUserOverflowing(el.scrollHeight > 400);
    });
  }, [message.content, isUser, isUserExpanded]);

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
      openArtifactInPanel(existing);
      return;
    }

    const artifact = {
      id: crypto.randomUUID(),
      type: (part.artifactType || "DOCUMENT") as ArtifactType,
      title: part.title || "Документ",
      content: part.content,
      version: 1,
    };
    openArtifactInPanel(artifact);
  };

  const handleOpenEditedArtifact = (title: string) => {
    const target = findByTitle(title);
    if (target) {
      openArtifactInPanel(target);
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
        const AgentIcon = agentIcon ? (ICON_MAP[agentIcon] || Triangle) : Triangle;
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
          {isUser ? "Вы" : (agentName || "Sanbao")}
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
                className="rounded-xl bg-violet-50 border border-violet-200 px-3 py-2 text-xs text-violet-700 leading-relaxed max-h-[300px] overflow-y-auto"
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
          ref={isAssistant ? bubbleRef : isUser ? userBubbleRef : undefined}
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-accent text-white rounded-tr-md"
              : "bg-surface-alt text-text-primary rounded-tl-md border border-border",
            isAssistant && !isExpanded && "max-h-[500px] overflow-hidden relative",
            isAssistant && isExpanded && "overflow-x-auto",
            isUser && !isUserExpanded && isUserOverflowing && "max-h-[400px] overflow-hidden relative",
          )}
        >
          {isAssistant ? (
            <div className="prose-sanbao">
              {hasSpecialParts ? (
                // Render with inline artifact/edit cards
                parts.map((part, i) => {
                  if (part.type === "text") {
                    return part.content.trim() ? (
                      <ReactMarkdown
                        key={i}
                        remarkPlugins={[remarkGfm]}
                        urlTransform={urlTransform}
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
                        className="my-2 w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 hover:border-emerald-400 hover:shadow-sm transition-all cursor-pointer text-left group/edit"
                      >
                        <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                          <Pencil className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {part.title}
                          </p>
                          <p className="text-xs text-emerald-600">
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
                  urlTransform={urlTransform}
                  components={markdownComponents}
                >
                  {message.content.replace(CLARIFY_REGEX, "").trim()}
                </ReactMarkdown>
              )}
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}

          {/* Gradient overlay + expand button for collapsed user messages */}
          {isUser && !isUserExpanded && isUserOverflowing && (
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-accent via-accent/90 to-transparent flex items-end justify-center pb-2">
              <button
                onClick={() => setIsUserExpanded(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-white/20 border border-white/30 shadow-sm text-white hover:bg-white/30 transition-colors cursor-pointer"
              >
                <ChevronDown className="h-3 w-3" />
                Показать полностью
              </button>
            </div>
          )}

          {/* Gradient overlay + expand button for collapsed messages */}
          {isAssistant && !isExpanded && isOverflowing && (
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-surface-alt via-surface-alt/90 to-transparent flex items-end justify-center pb-2">
              <button
                onClick={() => setIsExpanded(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-surface border border-border shadow-sm text-text-primary hover:border-accent hover:text-accent transition-colors cursor-pointer"
              >
                <ChevronDown className="h-3 w-3" />
                Показать полностью
              </button>
            </div>
          )}
        </div>

        {/* Collapse button when expanded — assistant */}
        {isAssistant && isExpanded && isOverflowing && (
          <div className="flex justify-center mt-2">
            <button
              onClick={() => setIsExpanded(false)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-surface border border-border shadow-sm text-text-primary hover:border-accent hover:text-accent transition-colors cursor-pointer"
            >
              <ChevronDown className="h-3 w-3 rotate-180" />
              Свернуть
            </button>
          </div>
        )}

        {/* Collapse button when expanded — user */}
        {isUser && isUserExpanded && isUserOverflowing && (
          <div className="flex justify-end mt-2">
            <button
              onClick={() => setIsUserExpanded(false)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-surface border border-border shadow-sm text-text-primary hover:border-accent hover:text-accent transition-colors cursor-pointer"
            >
              <ChevronDown className="h-3 w-3 rotate-180" />
              Свернуть
            </button>
          </div>
        )}

        {/* Legal References */}
        {message.legalRefs && message.legalRefs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.legalRefs.map((ref) => (
              <LegalReference key={ref.id} reference={ref} />
            ))}
          </div>
        )}

        {/* Actions — assistant */}
        {isAssistant && (
          <div className={cn(
            "flex items-center gap-1 mt-1.5 transition-opacity",
            isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            <button
              onClick={handleCopy}
              className={cn(
                "rounded-md text-text-muted hover:text-text-primary hover:bg-surface-alt flex items-center gap-1 transition-colors cursor-pointer",
                isMobile ? "h-8 px-3 text-xs" : "h-6 px-2 text-[10px]"
              )}
            >
              {copied ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Скопировано" : "Копировать"}
            </button>
            {onRetry && (
              <button
                onClick={() => onRetry(message.id)}
                className={cn(
                  "rounded-md text-text-muted hover:text-text-primary hover:bg-surface-alt flex items-center gap-1 transition-colors cursor-pointer",
                  isMobile ? "h-8 px-3 text-xs" : "h-6 px-2 text-[10px]"
                )}
              >
                <RotateCcw className="h-3 w-3" />
                Повторить
              </button>
            )}
          </div>
        )}

        {/* Actions — user (copy) */}
        {isUser && (
          <div className={cn(
            "flex items-center gap-1 mt-1.5 transition-opacity justify-end",
            isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            <button
              onClick={handleCopy}
              className={cn(
                "rounded-md text-text-muted hover:text-text-primary hover:bg-surface-alt flex items-center gap-1 transition-colors cursor-pointer",
                isMobile ? "h-8 px-3 text-xs" : "h-6 px-2 text-[10px]"
              )}
            >
              {copied ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
