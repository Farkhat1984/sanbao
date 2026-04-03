"use client";

import { useMemo, memo } from "react";
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
import { StreamingLabel } from "./StreamingLabel";
import { useArtifactStore } from "@/stores/artifactStore";
import { useChatStore, type SwarmAgentResponse } from "@/stores/chatStore";
import { openArtifactInPanel } from "@/lib/panel-actions";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMessageCollapse } from "@/hooks/useMessageCollapse";
import { useAutoApplyEdits } from "@/hooks/useAutoApplyEdits";
import { useTranslation } from "@/hooks/useTranslation";
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
  const { t } = useTranslation();
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
  const isToolPhase = streamingPhase === "searching" || streamingPhase === "using_tool";
  const streamingCategory = isCurrentlyStreaming && isToolPhase
    ? getToolCategory(streamingToolName ?? null)
    : null;

  // Parse artifacts and edits from assistant messages
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

  // Collapse logic for assistant and user messages
  const assistantCollapse = useMessageCollapse({
    enabled: isAssistant,
    skipDetection: isCurrentlyStreaming,
    collapseHeight: ASSISTANT_COLLAPSE_HEIGHT,
    content: displayContent,
    measureDelay: 250,
  });

  const userCollapse = useMessageCollapse({
    enabled: isUser,
    collapseHeight: USER_COLLAPSE_HEIGHT,
    content: displayContent,
  });

  // Auto-apply edits to existing artifacts
  const appliedVersions = useAutoApplyEdits({
    messageId: message.id,
    parts,
    isAssistant,
    displayContent,
    findByTitle,
    applyEdits,
  });

  const handleOpenArtifact = (part: ParsedPart) => {
    const existing = findByTitle(part.title || "");
    if (existing) {
      openArtifactInPanel(existing);
      return;
    }
    openArtifactInPanel({
      id: crypto.randomUUID(),
      type: (part.artifactType || "DOCUMENT") as ArtifactType,
      title: part.title || t("chat.document"),
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
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn("group flex gap-3 py-3", isUser && "flex-row-reverse")}
      role="article"
      aria-label={isUser ? t("chat.userMessage") : t("chat.assistantMessage")}
    >
      <MessageAvatar
        isUser={isUser}
        agentIcon={agentIcon}
        agentIconColor={agentIconColor}
        streamingCategory={streamingCategory}
      />

      <div className={cn("flex-1 min-w-0", isUser && "max-w-[85%] flex flex-col items-end")}>
        <span className="text-[11px] font-medium text-text-secondary mb-1 block">
          {isUser ? t("chat.you") : (
            <StreamingLabel
              agentName={agentName}
              streamingPhase={streamingPhase}
              streamingCategory={streamingCategory}
              isCurrentlyStreaming={isCurrentlyStreaming}
            />
          )}
        </span>

        {isAssistant && displayReasoning && <ReasoningBlock reasoning={displayReasoning} />}
        {isAssistant && message.planContent && <PlanBlock content={message.planContent} />}

        {/* Message bubble */}
        <div
          ref={isAssistant ? assistantCollapse.ref : isUser ? userCollapse.ref : undefined}
          className={cn(
            "text-sm leading-relaxed transition-[background-color,border-color,padding,max-height] duration-300",
            isUser
              ? "rounded-2xl px-4 py-3 bg-accent text-white rounded-tr-md"
              : isRichMd
                ? "rounded-2xl px-4 py-3 bg-surface-alt text-text-primary rounded-tl-md border border-border"
                : "text-text-primary py-1",
            isAssistant && !isCurrentlyStreaming && !assistantCollapse.isExpanded && assistantCollapse.isOverflowing && "overflow-hidden relative",
            isAssistant && !isCurrentlyStreaming && assistantCollapse.isExpanded && "overflow-x-auto",
            isUser && !userCollapse.isExpanded && userCollapse.isOverflowing && "overflow-hidden relative",
          )}
          style={{
            ...(isAssistant && !isCurrentlyStreaming && !assistantCollapse.isExpanded && assistantCollapse.isOverflowing ? { maxHeight: ASSISTANT_COLLAPSE_HEIGHT } : {}),
            ...(isUser && !userCollapse.isExpanded && userCollapse.isOverflowing ? { maxHeight: USER_COLLAPSE_HEIGHT } : {}),
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
              appliedVersions={appliedVersions}
            />
          ) : (
            <p className="whitespace-pre-wrap">{displayContent}</p>
          )}

          {isUser && !userCollapse.isExpanded && userCollapse.isOverflowing && (
            <CollapseOverlay variant="user" onToggle={() => userCollapse.setIsExpanded(true)} isExpanded={false} />
          )}
          {isAssistant && !isCurrentlyStreaming && !assistantCollapse.isExpanded && assistantCollapse.isOverflowing && (
            <CollapseOverlay variant="assistant" isRichMd={isRichMd} onToggle={() => assistantCollapse.setIsExpanded(true)} isExpanded={false} />
          )}
        </div>

        {isAssistant && assistantCollapse.isExpanded && assistantCollapse.isOverflowing && (
          <CollapseOverlay variant="assistant" onToggle={() => assistantCollapse.setIsExpanded(false)} isExpanded={true} />
        )}
        {isUser && userCollapse.isExpanded && userCollapse.isOverflowing && (
          <CollapseOverlay variant="user" onToggle={() => userCollapse.setIsExpanded(false)} isExpanded={true} />
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
