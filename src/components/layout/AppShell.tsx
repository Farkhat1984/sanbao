"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Header } from "@/components/layout/Header";
import { ArtifactPanel } from "@/components/artifacts/ArtifactPanel";
import { useArtifactStore } from "@/stores/artifactStore";
import { useSidebarStore } from "@/stores/sidebarStore";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isOpen: artifactOpen } = useArtifactStore();
  const { isOpen: sidebarOpen } = useSidebarStore();

  return (
    <div className="h-screen flex overflow-hidden bg-bg">
      {/* Sidebar */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
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
        <main className="flex-1 min-h-0 overflow-hidden flex">
          {/* Chat Area */}
          <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">{children}</div>

          {/* Artifact Panel */}
          <AnimatePresence>
            {artifactOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 480, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="border-l border-border overflow-hidden shrink-0"
              >
                <ArtifactPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
