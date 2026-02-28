"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Header } from "@/components/layout/Header";
import { UnifiedPanel } from "@/components/panel/UnifiedPanel";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { usePanelStore } from "@/stores/panelStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import { useIsMobile } from "@/hooks/useIsMobile";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isOpen: panelOpen } = usePanelStore();
  const { isOpen: sidebarOpen, close: closeSidebar } = useSidebarStore();
  const isMobile = useIsMobile();

  // Auto-close sidebar on mobile on initial render
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      closeSidebar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  return (
    <div className="h-screen flex overflow-hidden bg-bg">
      {/* Onboarding Tour */}
      <OnboardingTour />

      {/* Sidebar — desktop: animated panel, mobile: overlay */}
      {isMobile ? (
        <AnimatePresence>
          {sidebarOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 mobile-overlay-backdrop"
                onClick={closeSidebar}
              />
              {/* Sidebar drawer */}
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Навигация"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed top-0 bottom-0 left-0 z-50 w-[85vw] max-w-[320px] h-[100dvh] overscroll-contain touch-pan-y"
              >
                <Sidebar />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      ) : (
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
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <Header />
        <main className="flex-1 min-h-0 overflow-hidden flex">
          {/* Chat Area */}
          <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">
            {children}
          </div>

          {/* Unified Panel — desktop: side-by-side, mobile: fullscreen (handled inside) */}
          <UnifiedPanel />
        </main>
      </div>
    </div>
  );
}
