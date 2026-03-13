"use client";

import { useState, useEffect, useRef, useMemo, memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LegalReference } from "./LegalReference";
import { PlanBlock } from "./PlanBlock";
import { MessageAvatar } from "./MessageAvatar";
import { ReasoningBlock } from "./ReasoningBlock";
import { MessageActions } from "./MessageActions";
import { CollapseOverlay } from "./CollapseOverlay";
import { SwarmResponses } from "./SwarmResponses";
import { AssistantContent } from "./AssistantContent";
import { useArtifactStore } from "@/stores/artifactStore";
import { useChatStore, type SwarmAgentResponse } from "@/stores/chatStore";
import { openArtifactInPanel } from "@/lib/panel-actions";
import { useIsMobile } from "@/hooks/useIsMobile";
import { parseContentWithArtifacts } from "@/lib/parse-message-content";
import { getToolCategory } from "@/lib/chat/tool-categories";
import type { ParsedPart } from "@/lib/parse-message-content";
import type { ChatMessage, ArtifactType } from "@/types/chat";

// ─── Constants ────────────────────────────────────────────

/** Stable empty array to avoid referential inequality in Zustand selectors */
const EMPTY_RESPONSES: SwarmAgentResponse[] = [];

/** Height threshold (px) above which assistant messages are collapsed */
const ASSISTANT_COLLAPSE_HEIGHT = 500;

/** Height threshold (px) above which user messages are collapsed */
const USER_COLLAPSE_HEIGHT = 400;

/** Detect if content contains rich markdown (code blocks, tables, lists, headers) */
const RICH_MD_RE = /```|^\|.+\|/m;
const RICH_MD_BLOCK_RE = /^(\s*[-*+]\s|#{1,6}\s|>\s|\d+\.\s)/m;

function hasRichMarkdown(content: string): boolean {
  return RICH_MD_RE.test(content) || RICH_MD_BLOCK_RE.test(content);
}

// ─── Component ───────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage;
  isLast: boolean;
  agentName?: string;
  agentIcon?: string;
  agentIconColor?: string;
  onRetry?: (messageId: string) => void;
}

export const MessageBubble = memo(function MessageBubble({ message, isLast, agentName, agentIcon, agentIconColor, onRetry }: MessageBubbleProps) {
  const findByTitle = useArtifactStore((s) => s.findByTitle);
  const applyEdits = useArtifactStore((s) => s.applyEdits);
  const isMobile = useIsMobile();
  const isUser = message.role === "USER";
  const isAssistant = message.role === "ASSISTANT";

  // During streaming, read from the lightweight streaming buffer
  const streamingContent = useChatStore((s) =>
    isLast && isAssistant && s.isStreaming ? s.streamingContent : null
  );
  const streamingReasoning = useChatStore((s) =>
    isLast && isAssistant && s.isStreaming ? s.streamingReasoning : null
  );
  const isCurrentlyStreaming = useChatStore((s) =>
    isLast && isAssistant && s.isStreaming
  );
  const streamingPhase = useChatStore((s) =>
    isLast && isAssistant && s.isStreaming ? s.streamingPhase : null
  );
  const streamingToolName = useChatStore((s) =>
    isLast && isAssistant && s.isStreaming ? s.streamingToolName : null
  );
  const swarmAgentResponses = useChatStore((s) =>
    isLast && isAssistant ? s.swarmAgentResponses : EMPTY_RESPONSES
  );
  const displayContent = streamingContent ?? message.content;
  const displayReasoning = streamingReasoning ?? message.reasoning;

  // Compute tool category for avatar streaming state
  // Only morph avatar during actual tool use (searching/using_tool)
  const isToolPhase = streamingPhase === "searching" || streamingPhase === "using_tool";
  const streamingCategory = isCurrentlyStreaming && isToolPhase
    ? getToolCategory(streamingToolName ?? null)
    : null;

  // Status label shown next to agent name during streaming
  const TOOL_LABELS: Record<string, string> = {
    web_search: "Ищет в интернете",
    knowledge: "Ищу в базе",
    calculation: "Вычисляет",
    memory: "Сохраняю",
    task: "Создаю задачу",
    chart: "Строю график",
    mcp: "Плагин",
    generic: "Ищу",
  };
  const streamingLabel = isCurrentlyStreaming && streamingPhase
    ? streamingPhase === "answering"
      ? null
      : streamingPhase === "routing"
        ? "Определяю агентов"
        : streamingPhase === "consulting"
          ? "Консультирую агентов"
          : streamingPhase === "synthesizing"
            ? "Формирую решение"
            : streamingPhase === "planning"
              ? "Составляю план"
              : isToolPhase
                ? TOOL_LABELS[streamingCategory || "generic"] || "Ищу"
                : "отвечает"
    : null;

  // Track which edits we've already applied (by message id)
  const appliedEditsRef = useRef<Set<string>>(new Set());

  // Collapse long assistant messages
  const [isExpanded, setIsExpanded] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // Collapse long user messages (~20 lines = 400px)
  const [isUserExpanded, setIsUserExpanded] = useState(false);
  const userBubbleRef = useRef<HTMLDivElement>(null);
  const [isUserOverflowing, setIsUserOverflowing] = useState(false);

  // Parse artifacts and edits from assistant messages (always, to avoid DOM flash on stream end)
  const parts = useMemo(
    () => (isAssistant ? parseContentWithArtifacts(displayContent) : []),
    [isAssistant, displayContent]
  );
  const hasSpecialParts = useMemo(
    () => parts.some((p) => p.type === "artifact" || p.type === "edit"),
    [parts]
  );

  // Determine if assistant message has rich markdown (needs bordered container)
  const isRichMd = useMemo(
    () => isAssistant && (hasSpecialParts || hasRichMarkdown(displayContent)),
    [isAssistant, hasSpecialParts, displayContent]
  );

  // Detect overflow for assistant messages (skip during streaming, delay after stream ends)
  useEffect(() => {
    if (!isAssistant || isExpanded || isCurrentlyStreaming) return;
    const el = bubbleRef.current;
    if (!el) return;
    // Delay to let CSS transitions settle and avoid layout thrash
    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        if (el) setIsOverflowing(el.scrollHeight > ASSISTANT_COLLAPSE_HEIGHT);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [displayContent, isAssistant, isExpanded, isCurrentlyStreaming]);

  // Detect overflow for user messages
  useEffect(() => {
    if (!isUser || isUserExpanded) return;
    const el = userBubbleRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      setIsUserOverflowing(el.scrollHeight > USER_COLLAPSE_HEIGHT);
    });
  }, [displayContent, isUser, isUserExpanded]);

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
  }, [message.id, displayContent, findByTitle, applyEdits]);

  const handleOpenArtifact = (part: ParsedPart) => {
    const existing = findByTitle(part.title || "");
    if (existing) {
      openArtifactInPanel(existing);
      return;
    }
    openArtifactInPanel({
      id: crypto.randomUUID(),
      type: (part.artifactType || "DOCUMENT") as ArtifactType,
      title: part.title || "Документ",
      content: part.content,
      version: 1,
    });
  };

  const handleOpenEditedArtifact = (title: string) => {
    const target = findByTitle(title);
    if (target) openArtifactInPanel(target);
  };

  return (
    <motion.div
      initial={isLast && !isCurrentlyStreaming ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("group flex gap-3 py-3", isUser && "flex-row-reverse")}
      role="article"
      aria-label={isUser ? "Сообщение пользователя" : "Ответ ассистента"}
    >
      <MessageAvatar
        isUser={isUser}
        agentIcon={agentIcon}
        agentIconColor={agentIconColor}
        streamingCategory={streamingCategory}
      />

      <div className={cn("flex-1 min-w-0", isUser && "max-w-[85%] flex flex-col items-end")}>
        <span className="text-[11px] font-medium text-text-secondary mb-1 block">
          {isUser ? "Вы" : streamingLabel ? (
            <span className="inline-flex items-center gap-1">
              <span>{agentName || "Sanbao"}</span>
              <span className="text-accent">· {streamingLabel}</span>
            </span>
          ) : (agentName || "Sanbao")}
        </span>

        {isAssistant && displayReasoning && <ReasoningBlock reasoning={displayReasoning} />}
        {isAssistant && message.planContent && <PlanBlock content={message.planContent} />}

        {/* Message bubble */}
        <div
          ref={isAssistant ? bubbleRef : isUser ? userBubbleRef : undefined}
          className={cn(
            "text-sm leading-relaxed transition-[background-color,border-color,padding] duration-200",
            isUser
              ? "rounded-2xl px-4 py-3 bg-accent text-white rounded-tr-md"
              : isRichMd
                ? "rounded-2xl px-4 py-3 bg-surface-alt text-text-primary rounded-tl-md border border-border"
                : "text-text-primary py-1",
            isAssistant && !isCurrentlyStreaming && !isExpanded && isOverflowing && "overflow-hidden relative",
            isAssistant && !isCurrentlyStreaming && isExpanded && "overflow-x-auto",
            isUser && !isUserExpanded && isUserOverflowing && "overflow-hidden relative",
          )}
          style={{
            ...(isAssistant && !isCurrentlyStreaming && !isExpanded && isOverflowing ? { maxHeight: ASSISTANT_COLLAPSE_HEIGHT } : {}),
            ...(isUser && !isUserExpanded && isUserOverflowing ? { maxHeight: USER_COLLAPSE_HEIGHT } : {}),
          }}
        >
          {isAssistant ? (
            <AssistantContent
              parts={parts}
              hasSpecialParts={hasSpecialParts}
              displayContent={displayContent}
              onOpenArtifact={handleOpenArtifact}
              onOpenEditedArtifact={handleOpenEditedArtifact}
              findByTitle={findByTitle}
            />
          ) : (
            <p className="whitespace-pre-wrap">{displayContent}</p>
          )}

          {isUser && !isUserExpanded && isUserOverflowing && (
            <CollapseOverlay variant="user" onToggle={() => setIsUserExpanded(true)} isExpanded={false} />
          )}
          {isAssistant && !isCurrentlyStreaming && !isExpanded && isOverflowing && (
            <CollapseOverlay variant="assistant" isRichMd={isRichMd} onToggle={() => setIsExpanded(true)} isExpanded={false} />
          )}
        </div>

        {isAssistant && isExpanded && isOverflowing && (
          <CollapseOverlay variant="assistant" onToggle={() => setIsExpanded(false)} isExpanded={true} />
        )}
        {isUser && isUserExpanded && isUserOverflowing && (
          <CollapseOverlay variant="user" onToggle={() => setIsUserExpanded(false)} isExpanded={true} />
        )}

        {message.legalRefs && message.legalRefs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.legalRefs.map((ref) => (
              <LegalReference key={ref.id} reference={ref} />
            ))}
          </div>
        )}

        {isAssistant && <SwarmResponses responses={swarmAgentResponses} />}

        {(isUser || isAssistant) && (
          <MessageActions
            content={message.content}
            messageId={message.id}
            isUser={isUser}
            isMobile={isMobile}
            onRetry={isAssistant ? onRetry : undefined}
          />
        )}
      </div>
    </motion.div>
  );
});
