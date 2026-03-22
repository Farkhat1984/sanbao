"use client";

import { memo } from "react";
import { Copy, Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

interface MessageActionsProps {
  /** Raw text content to copy to clipboard */
  content: string;
  /** Message ID passed to onRetry callback */
  messageId: string;
  /** Whether this is a user message (controls layout alignment) */
  isUser: boolean;
  /** Whether the viewport is mobile-sized (controls visibility) */
  isMobile: boolean;
  /** Retry callback — only shown for assistant messages when provided */
  onRetry?: (messageId: string) => void;
}

/** Action buttons (copy, regenerate) shown on hover for both user and assistant messages. */
export const MessageActions = memo(function MessageActions({ content, messageId, isUser, isMobile, onRetry }: MessageActionsProps) {
  const { copied, copy: handleCopy } = useCopyToClipboard();

  const buttonClass = cn(
    "rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-alt flex items-center gap-1 transition-colors cursor-pointer",
    isMobile ? "h-8 px-3 text-xs" : "h-6 px-2 text-[10px]"
  );

  return (
    <div className={cn(
      "flex items-center gap-1 mt-1.5 transition-opacity",
      isUser && "justify-end",
      isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
    )}>
      <button
        onClick={() => handleCopy(content)}
        aria-label="Копировать сообщение"
        className={buttonClass}
      >
        {copied ? (
          <Check className="h-3 w-3 text-success" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
        {copied ? "Скопировано" : "Копировать"}
      </button>
      {!isUser && onRetry && (
        <button
          onClick={() => onRetry(messageId)}
          aria-label="Повторить запрос"
          className={buttonClass}
        >
          <RotateCcw className="h-3 w-3" />
          Повторить
        </button>
      )}
    </div>
  );
});
