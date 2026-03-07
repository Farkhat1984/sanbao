"use client";

import { useState, useCallback } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import { groupByDate } from "@/lib/utils";
import { ConversationItem } from "./ConversationItem";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Archive, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/types/chat";

function ArchiveSection() {
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
    <div className="mt-3 border-t border-border pt-2">
      <button
        onClick={toggleExpand}
        className={cn(
          "w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs",
          "text-text-muted hover:text-text-secondary hover:bg-surface-hover",
          "transition-colors duration-150 cursor-pointer"
        )}
      >
        <Archive className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium">Архив</span>
        {count !== null && count > 0 && (
          <span className="ml-auto mr-1 text-[10px] bg-surface-alt text-text-muted rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {count}
          </span>
        )}
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200",
            count !== null && count > 0 ? "" : "ml-auto",
            expanded && "rotate-90"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {loading && (
              <div className="flex items-center justify-center py-4">
                <div className="h-4 w-4 border-2 border-text-muted/30 border-t-text-muted rounded-full animate-spin" />
              </div>
            )}

            {!loading && archivedConversations.length === 0 && loaded && (
              <p className="text-xs text-text-muted px-2.5 py-3 text-center">
                Нет архивных чатов
              </p>
            )}

            {!loading && archivedConversations.length > 0 && (
              <div className="opacity-75 mt-1">
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ConversationList() {
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const searchQuery = useSidebarStore((s) => s.searchQuery);

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groups = groupByDate(filtered);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="h-10 w-10 rounded-xl bg-surface-alt flex items-center justify-center mb-3">
          <MessageSquare className="h-5 w-5 text-text-muted" />
        </div>
        <p className="text-sm text-text-muted">
          {searchQuery ? "Ничего не найдено" : "Нет чатов"}
        </p>
        {!searchQuery && <ArchiveSection />}
      </div>
    );
  }

  return (
    <div className="px-2 py-1">
      <AnimatePresence initial={false}>
        {Object.entries(groups).map(([label, convs]) => (
          <motion.div
            key={label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-1"
          >
            <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider px-2 py-1.5">
              {label}
            </p>
            {convs.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
              />
            ))}
          </motion.div>
        ))}
      </AnimatePresence>

      <ArchiveSection />
    </div>
  );
}
