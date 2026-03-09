"use client";

import { useState } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import { ConversationItem } from "./ConversationItem";
import { Pin, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function PinnedSection() {
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const searchQuery = useSidebarStore((s) => s.searchQuery);
  const [expanded, setExpanded] = useState(false);

  const pinned = conversations.filter(
    (c) => c.pinned && c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (pinned.length === 0) return null;

  return (
    <div className="border-b border-border shrink-0">
      <div className="px-2 py-1">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary uppercase tracking-wider px-2 py-1.5 w-full hover:text-text-primary transition-colors"
        >
          <Pin className="h-3 w-3 shrink-0" />
          <span>Закреплённые</span>
          <span className="ml-auto mr-1 text-[10px] bg-surface-alt text-text-secondary rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {pinned.length}
          </span>
          <ChevronRight
            className={cn(
              "h-3 w-3 shrink-0 transition-transform duration-200",
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
              <div className="max-h-[30vh] overflow-y-auto">
                {pinned.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isActive={conv.id === activeConversationId}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
