"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AdminNavLinks } from "@/components/admin/AdminNavLinks";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useIsMobile();
  const pathname = usePathname();

  // Auto-close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-4 h-14 flex items-center gap-2 border-b border-border">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-accent to-legal-ref flex items-center justify-center">
          <ShieldCheck className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold text-text-primary text-sm">
          Админ-панель
        </span>
        {isMobile && (
          <button
            onClick={() => setDrawerOpen(false)}
            className="ml-auto h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <AdminNavLinks onNavigate={isMobile ? () => setDrawerOpen(false) : undefined} />
      </nav>

      {/* Back to chat */}
      <div className="p-3 border-t border-border">
        <Link
          href="/chat"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Вернуться в чат
        </Link>
      </div>
    </>
  );

  return (
    <div className="h-screen flex bg-bg">
      {/* Sidebar — desktop: static, mobile: drawer */}
      {isMobile ? (
        <>
          {/* Mobile header */}
          <div className="fixed top-0 left-0 right-0 z-30 h-14 flex items-center gap-3 px-4 border-b border-border bg-surface/95 backdrop-blur-sm">
            <button
              onClick={() => setDrawerOpen(true)}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" />
              <span className="font-semibold text-text-primary text-sm">
                Админ-панель
              </span>
            </div>
          </div>

          {/* Drawer */}
          <AnimatePresence>
            {drawerOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-40 mobile-overlay-backdrop"
                  onClick={() => setDrawerOpen(false)}
                />
                <motion.aside
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[300px] flex flex-col bg-surface border-r border-border"
                >
                  {sidebarContent}
                </motion.aside>
              </>
            )}
          </AnimatePresence>

          {/* Main content with top padding for fixed header */}
          <main className="flex-1 overflow-y-auto pt-14">
            <div className="max-w-6xl mx-auto px-4 py-6">
              {children}
            </div>
          </main>
        </>
      ) : (
        <>
          {/* Desktop sidebar */}
          <aside className="w-[240px] h-screen flex flex-col border-r border-border bg-surface shrink-0">
            {sidebarContent}
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-8 py-8">
              {children}
            </div>
          </main>
        </>
      )}
    </div>
  );
}
