"use client";

import { useState, useCallback } from "react";
import { Archive, CaretRight } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { ConversationItem } from "./ConversationItem";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/types/chat";

export function ArchiveSection() {
  const [expanded, setExpanded] = useState(false);
  const [archivedConversations, setArchivedConversations] = useState<ConversationSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const activeConversationId = useChatStore((s) => s.activeConversationId);

  const toggleExpand = useCallback(async () => {
    const next = !expanded;
    setExpanded(next);

    if (next && !loaded) {
      setLoading(true);
      try {
        const res = await fetch("/api/conversations?archived=true&limit=200");
        if (res.ok) {
          const data = await res.json();
          setArchivedConversations(data.items ?? []);
        }
      } catch {
        /* silent — user can retry by collapsing and expanding */
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    }
  }, [expanded, loaded]);

  const handleUnarchive = useCallback((id: string) => {
    setArchivedConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const count = loaded ? archivedConversations.length : null;

  return (
    <div className="border-t border-border shrink-0">
      <div className="px-2 py-1">
        <button
          onClick={toggleExpand}
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs",
            "text-text-secondary hover:text-text-secondary hover:bg-surface-hover",
            "transition-colors duration-150 cursor-pointer"
          )}
        >
          <Archive weight="duotone" className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">Архив</span>
          {count !== null && count > 0 && (
            <span className="ml-auto mr-1 text-[10px] bg-surface-alt text-text-secondary rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
              {count}
            </span>
          )}
          <CaretRight
            weight="duotone"
            className={cn(
              "h-3 w-3 shrink-0 transition-transform duration-200",
              count !== null && count > 0 ? "" : "ml-auto",
              expanded && "rotate-90"
            )}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-2 max-h-[40vh] overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-4">
                  <div className="h-4 w-4 border-2 border-text-muted/30 border-t-text-muted rounded-full animate-spin" />
                </div>
              )}

              {!loading && archivedConversations.length === 0 && loaded && (
                <p className="text-xs text-text-secondary px-2.5 py-3 text-center">
                  Нет архивных чатов
                </p>
              )}

              {!loading && archivedConversations.length > 0 && (
                <div className="opacity-75">
                  {archivedConversations.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={conv.id === activeConversationId}
                      isArchived
                      onUnarchive={handleUnarchive}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
