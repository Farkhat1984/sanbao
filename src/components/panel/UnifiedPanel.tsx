"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowLeft, AlertTriangle } from "lucide-react";
import { usePanelStore } from "@/stores/panelStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { PanelTabBar } from "./PanelTabBar";
import { ArtifactContent } from "./ArtifactContent";
import { ArticleContentView } from "./ArticleContentView";

const springTransition = { type: "spring" as const, damping: 25, stiffness: 300 };

// ─── Error boundary for panel content ────────────────────

interface PanelErrorBoundaryState {
  hasError: boolean;
}

class PanelErrorBoundary extends React.Component<
  { children: React.ReactNode },
  PanelErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): PanelErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-error" />
          </div>
          <p className="text-sm text-text-primary font-medium">
            Не удалось отобразить содержимое
          </p>
          <p className="text-xs text-text-muted max-w-[240px]">
            Произошла ошибка при загрузке панели. Попробуйте снова.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-1 px-4 py-2 text-sm font-medium rounded-xl bg-accent text-white hover:bg-accent/90 transition-colors cursor-pointer"
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function UnifiedPanel() {
  const {
    isOpen,
    tabs,
    activeTabId,
    panelWidthPercent,
    setPanelWidthPercent,
    closePanel,
  } = usePanelStore();
  const isMobile = useIsMobile();
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) closePanel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closePanel]);

  // Resize handle for desktop
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isMobile) return;
      e.preventDefault();
      isDraggingRef.current = true;
      setIsDragging(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDraggingRef.current) return;
        // Find the parent main element (the flex container)
        const mainEl = panelRef.current?.parentElement;
        if (!mainEl) return;
        const rect = mainEl.getBoundingClientRect();
        const totalWidth = rect.width;
        const offsetFromRight = rect.right - ev.clientX;
        const pct = Math.min(80, Math.max(20, (offsetFromRight / totalWidth) * 100));
        setPanelWidthPercent(pct);
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        setIsDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [setPanelWidthPercent, isMobile]
  );

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Content router
  const renderContent = () => {
    if (!activeTab) return null;
    if (activeTab.kind === "artifact") return <ArtifactContent />;
    if (activeTab.kind === "article") return <ArticleContentView />;
    if (activeTab.kind === "image" && activeTab.imageSrc) {
      return (
        <div className="h-full flex items-center justify-center p-4 overflow-auto bg-surface-alt">
          <img
            src={activeTab.imageSrc}
            alt={activeTab.label}
            className="max-w-full max-h-full object-contain rounded-xl border border-border shadow-sm"
          />
        </div>
      );
    }
    return null;
  };

  // ── Mobile: fullscreen overlay ──
  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={springTransition}
            className="fixed inset-0 z-50 bg-surface flex flex-col"
          >
            {/* Mobile header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
              <button
                onClick={closePanel}
                className="h-9 w-9 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex-1 min-w-0 overflow-hidden">
                <PanelTabBar />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <PanelErrorBoundary>
                {renderContent()}
              </PanelErrorBoundary>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ── Desktop: side panel with resize ──
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: `${panelWidthPercent}%`, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={isDragging ? { duration: 0 } : springTransition}
          className="overflow-hidden shrink-0 relative"
        >
          {/* Resize handle */}
          <div
            onMouseDown={handleMouseDown}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-accent/40 active:bg-accent/60 transition-colors"
          />
          <div className="h-full border-l border-border flex flex-col bg-surface">
            {/* Tab bar + close */}
            <div className="flex items-center gap-1 pr-2 shrink-0">
              <div className="flex-1 min-w-0 overflow-hidden">
                <PanelTabBar />
              </div>
              <button
                onClick={closePanel}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer shrink-0"
                title="Закрыть"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <PanelErrorBoundary>
                {renderContent()}
              </PanelErrorBoundary>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
