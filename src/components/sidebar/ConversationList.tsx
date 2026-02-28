"use client";

import { useChatStore } from "@/stores/chatStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import { groupByDate } from "@/lib/utils";
import { ConversationItem } from "./ConversationItem";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare } from "lucide-react";

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
    </div>
  );
}
