"use client";

import { useEffect, useRef, useCallback } from "react";
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

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AppShell({ children }: AppShellProps) {
  const { isOpen: panelOpen } = usePanelStore();
  const { isOpen: sidebarOpen, close: closeSidebar } = useSidebarStore();
  const isMobile = useIsMobile();

  const sidebarDrawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Auto-close sidebar when switching to mobile viewport.
  // `sidebarOpen` is intentionally excluded: including it would re-run
  // this effect every time the sidebar opens, making it impossible to
  // open the sidebar on mobile. `closeSidebar` is a stable zustand action.
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      closeSidebar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, closeSidebar]);

  // Focus trap for mobile sidebar drawer
  useEffect(() => {
    if (!isMobile || !sidebarOpen) return;

    // Store the element that had focus before the sidebar opened
    triggerRef.current = document.activeElement as HTMLElement;

    // Wait a frame for the drawer to render, then focus the first element
    const rafId = requestAnimationFrame(() => {
      const drawer = sidebarDrawerRef.current;
      if (!drawer) return;
      const first = drawer.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      first?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const drawer = sidebarDrawerRef.current;
      if (!drawer) return;

      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null); // visible only

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus to the trigger element (menu button) on close
      triggerRef.current?.focus();
    };
  }, [isMobile, sidebarOpen]);

  // Close mobile sidebar on Escape
  const handleSidebarKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") closeSidebar();
    },
    [closeSidebar]
  );

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
                ref={sidebarDrawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="Навигация"
                onKeyDown={handleSidebarKeyDown}
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
