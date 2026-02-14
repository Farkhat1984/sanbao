"use client";

import { useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Header } from "@/components/layout/Header";
import { ArtifactPanel } from "@/components/artifacts/ArtifactPanel";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { useArtifactStore } from "@/stores/artifactStore";
import { useSidebarStore } from "@/stores/sidebarStore";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isOpen: artifactOpen, panelWidthPercent, setPanelWidthPercent } =
    useArtifactStore();
  const { isOpen: sidebarOpen } = useSidebarStore();
  const mainRef = useRef<HTMLElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current || !mainRef.current) return;
        const rect = mainRef.current.getBoundingClientRect();
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
    [setPanelWidthPercent]
  );

  return (
    <div className="h-screen flex overflow-hidden bg-bg">
      {/* Onboarding Tour */}
      <OnboardingTour />

      {/* Sidebar */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            data-tour="sidebar"
            initial={{ width: 0 }}
            animate={{ width: 280 }}
            exit={{ width: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="shrink-0 overflow-hidden"
          >
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <Header />
        <main ref={mainRef} className="flex-1 min-h-0 overflow-hidden flex">
          {/* Chat Area */}
          <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">
            {children}
          </div>

          {/* Artifact Panel */}
          <AnimatePresence>
            {artifactOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: `${panelWidthPercent}%`, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="overflow-hidden shrink-0 relative"
                style={{ width: `${panelWidthPercent}%` }}
              >
                {/* Resize handle */}
                <div
                  onMouseDown={handleMouseDown}
                  className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-accent/40 active:bg-accent/60 transition-colors"
                />
                <div className="h-full border-l border-border">
                  <ArtifactPanel />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
