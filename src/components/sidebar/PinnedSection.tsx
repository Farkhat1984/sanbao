"use client";

import { useChatStore } from "@/stores/chatStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import { ConversationItem } from "./ConversationItem";
import { Pin } from "lucide-react";

export function PinnedSection() {
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const searchQuery = useSidebarStore((s) => s.searchQuery);

  const pinned = conversations.filter(
    (c) => c.pinned && c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (pinned.length === 0) return null;

  return (
    <div className="border-b border-border shrink-0">
      <div className="px-2 py-1">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary uppercase tracking-wider px-2 py-1.5">
          <Pin className="h-3 w-3" />
          Закреплённые
        </p>
        <div className="max-h-[30vh] overflow-y-auto">
          {pinned.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeConversationId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
