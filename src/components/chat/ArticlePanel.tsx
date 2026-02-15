"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, Minimize2, RotateCcw, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useArticleStore } from "@/stores/articleStore";
import { useIsMobile } from "@/hooks/useIsMobile";

const CODE_LABELS: Record<string, string> = {
  criminal_code: "УК РК",
  civil_code: "ГК РК",
  administrative_code: "КоАП РК",
  tax_code: "НК РК",
  labor_code: "ТК РК",
  land_code: "ЗК РК",
  environmental_code: "ЭК РК",
  business_code: "ПК РК",
  civil_procedure_code: "ГПК РК",
  criminal_procedure_code: "УПК РК",
};

const springTransition = { type: "spring" as const, damping: 25, stiffness: 300 };

// ─── Skeleton loader ─────────────────────────────────────

function ArticleSkeleton() {
  return (
    <div className="px-4 py-4 space-y-3 animate-pulse">
      <div className="h-5 w-3/4 bg-text-muted/10 rounded" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-text-muted/10 rounded" />
        <div className="h-3 w-full bg-text-muted/10 rounded" />
        <div className="h-3 w-5/6 bg-text-muted/10 rounded" />
        <div className="h-3 w-full bg-text-muted/10 rounded" />
        <div className="h-3 w-4/5 bg-text-muted/10 rounded" />
      </div>
      <div className="h-px bg-border my-3" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-text-muted/10 rounded" />
        <div className="h-3 w-3/4 bg-text-muted/10 rounded" />
      </div>
    </div>
  );
}

// ─── Error state ─────────────────────────────────────────

function ArticleError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center gap-3">
      <div className="h-12 w-12 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
        <BookOpen className="h-6 w-6 text-red-500" />
      </div>
      <p className="text-sm text-text-muted">{error}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-alt border border-border hover:border-accent text-text-primary transition-colors cursor-pointer"
      >
        <RotateCcw className="h-3 w-3" />
        Повторить
      </button>
    </div>
  );
}

// ─── Panel content ───────────────────────────────────────

function ArticleContent() {
  const { activeArticle, loading, error, retry } = useArticleStore();

  if (loading) return <ArticleSkeleton />;
  if (error) return <ArticleError error={error} onRetry={retry} />;
  if (!activeArticle) return null;

  return (
    <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
      <div className="px-4 py-4">
        {activeArticle.title && (
          <h3 className="text-base font-semibold text-text-primary mb-3">
            {activeArticle.title}
          </h3>
        )}
        <div className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
          {activeArticle.text}
        </div>
        {activeArticle.annotation && (
          <>
            <hr className="border-border my-4" />
            <div className="text-xs text-text-muted leading-relaxed whitespace-pre-wrap">
              <span className="font-medium text-text-secondary">Примечание: </span>
              {activeArticle.annotation}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────

export function ArticlePanel() {
  const {
    isOpen,
    isExpanded,
    activeArticle,
    loading,
    closePanel,
    toggleExpanded,
  } = useArticleStore();
  const isMobile = useIsMobile();

  // Escape key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) closePanel();
    },
    [isOpen, closePanel]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const headerLabel = activeArticle
    ? `Ст. ${activeArticle.article} ${CODE_LABELS[activeArticle.code] || activeArticle.code}`
    : loading
      ? "Загрузка..."
      : "Статья";

  // ── Mobile: bottom sheet ──
  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 mobile-overlay-backdrop"
              onClick={closePanel}
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={springTransition}
              className={cn(
                "fixed left-0 right-0 bottom-0 z-50 bg-surface rounded-t-2xl border-t border-border flex flex-col safe-bottom",
                isExpanded ? "top-0 rounded-t-none" : "max-h-[50vh]"
              )}
            >
              {/* Drag handle */}
              <div
                className="flex justify-center py-2 cursor-pointer"
                onClick={toggleExpanded}
              >
                <div className="w-10 h-1 rounded-full bg-text-muted/30" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 pb-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="h-4 w-4 text-legal-ref shrink-0" />
                  <span className="text-sm font-semibold text-text-primary truncate">
                    {headerLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={toggleExpanded}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                  >
                    {isExpanded ? (
                      <Minimize2 className="h-3.5 w-3.5" />
                    ) : (
                      <Maximize2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={closePanel}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <ArticleContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // ── Desktop: side panel ──
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{
            width: isExpanded ? "50%" : 420,
            opacity: 1,
          }}
          exit={{ width: 0, opacity: 0 }}
          transition={springTransition}
          className="overflow-hidden shrink-0 relative"
          style={{ width: isExpanded ? "50%" : 420 }}
        >
          <div className="h-full border-l border-border flex flex-col bg-surface">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="h-4 w-4 text-legal-ref shrink-0" />
                <span className="text-sm font-semibold text-text-primary truncate">
                  {headerLabel}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={toggleExpanded}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                  title={isExpanded ? "Свернуть" : "Развернуть"}
                >
                  {isExpanded ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={closePanel}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                  title="Закрыть"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <ArticleContent />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
