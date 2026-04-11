"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, Zap, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContextIndicatorProps {
  usagePercent: number;
  isCompacting: boolean;
  conversationId: string | null;
  onCompacted?: () => void;
}

const ACTION_THRESHOLD = 80;

export function ContextIndicator({
  usagePercent,
  isCompacting,
  conversationId,
  onCompacted,
}: ContextIndicatorProps) {
  const [showActions, setShowActions] = useState(false);
  const [compacting, setCompacting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [compactDone, setCompactDone] = useState(false);
  const dismissedRef = useRef(false);
  const prevAboveRef = useRef(usagePercent >= ACTION_THRESHOLD);

  useEffect(() => {
    const isAbove = usagePercent >= ACTION_THRESHOLD;
    const wasAbove = prevAboveRef.current;

    if (isAbove && !wasAbove) {
      dismissedRef.current = false;
    }

    if (isAbove && !dismissedRef.current && !isCompacting) {
      setShowActions(true);
    } else if (!isAbove) {
      setShowActions(false);
    }

    prevAboveRef.current = isAbove;
  }, [usagePercent, isCompacting]);

  const handleDismiss = useCallback(() => {
    dismissedRef.current = true;
    setShowActions(false);
  }, []);

  const handleCompact = useCallback(async () => {
    if (!conversationId || compacting) return;

    setCompacting(true);
    setCompactDone(false);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/compact`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Compact failed");

      setCompactDone(true);
      setTimeout(() => {
        setCompactDone(false);
        setShowActions(false);
        dismissedRef.current = true;
        onCompacted?.();
      }, 1500);
    } catch {
      // Silently handle — the button returns to idle state
    } finally {
      setCompacting(false);
    }
  }, [conversationId, compacting, onCompacted]);

  const handleDownload = useCallback(async () => {
    if (!conversationId || downloading) return;

    setDownloading(true);

    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/export?format=txt`
      );

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conversation-${conversationId}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Silently handle
    } finally {
      setDownloading(false);
    }
  }, [conversationId, downloading]);

  if (usagePercent < 30 && !isCompacting) return null;

  const isHigh = usagePercent >= 70;
  const isCritical = usagePercent >= 90;
  const actionsVisible =
    showActions && !isCompacting && usagePercent >= ACTION_THRESHOLD;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 px-3 py-1">
        <div className="flex-1 h-1 rounded-full bg-surface-alt overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isCritical ? "bg-error" : isHigh ? "bg-warning" : "bg-accent"
            )}
            style={{ width: `${Math.min(100, usagePercent)}%` }}
          />
        </div>
        <span className="text-[10px] text-text-secondary whitespace-nowrap">
          {isCompacting ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              Сжатие контекста
            </span>
          ) : (
            `Контекст: ${usagePercent}%`
          )}
        </span>
      </div>

      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          actionsVisible
            ? "max-h-24 opacity-100"
            : "max-h-0 opacity-0"
        )}
      >
        <div className="px-3 pb-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-warning leading-tight">
              Контекст почти заполнен. Рекомендуем сжать диалог или скачать его.
            </span>
            <button
              type="button"
              onClick={handleDismiss}
              className="ml-2 shrink-0 p-0.5 rounded text-text-muted hover:text-text-secondary transition-colors"
              aria-label="Закрыть"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCompact}
              disabled={compacting || !conversationId}
              className={cn(
                "flex items-center gap-1.5 bg-accent text-white hover:bg-accent/90 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {compacting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              {compactDone
                ? "Готово!"
                : compacting
                  ? "Сжатие..."
                  : "Сжать контекст"}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading || !conversationId}
              className={cn(
                "flex items-center gap-1.5 bg-surface-alt text-text-secondary hover:bg-surface-alt/80 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {downloading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              {downloading ? "Загрузка..." : "Скачать диалог"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
