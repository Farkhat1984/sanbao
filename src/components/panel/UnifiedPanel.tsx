"use client";

import { useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowLeft } from "lucide-react";
import { usePanelStore } from "@/stores/panelStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { PanelTabBar } from "./PanelTabBar";
import { ArtifactContent } from "./ArtifactContent";
import { ArticleContentView } from "./ArticleContentView";

const springTransition = { type: "spring" as const, damping: 25, stiffness: 300 };

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
  const isDragging = useRef(false);
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
      isDragging.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
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
        isDragging.current = false;
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
              {renderContent()}
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
          transition={springTransition}
          className="overflow-hidden shrink-0 relative"
          style={{ width: `${panelWidthPercent}%` }}
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
              {renderContent()}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
