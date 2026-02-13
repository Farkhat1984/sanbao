"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pin, Trash2, Archive } from "lucide-react";
import { motion } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { cn, truncate } from "@/lib/utils";
import type { ConversationSummary } from "@/types/chat";

interface ConversationItemProps {
  conversation: ConversationSummary;
  isActive: boolean;
}

export function ConversationItem({
  conversation,
  isActive,
}: ConversationItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { setActiveConversation, removeConversation } = useChatStore();
  const router = useRouter();

  const handleClick = () => {
    setActiveConversation(conversation.id);
    router.push(`/chat/${conversation.id}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    removeConversation(conversation.id);
    setShowMenu(false);
    fetch(`/api/conversations/${conversation.id}`, { method: "DELETE" }).catch(() => {});
  };

  return (
    <motion.div
      className="relative group"
      onMouseLeave={() => setShowMenu(false)}
    >
      <button
        onClick={handleClick}
        className={cn(
          "w-full text-left px-2.5 py-2 rounded-xl text-sm transition-all duration-150 cursor-pointer",
          "flex items-center gap-2",
          isActive
            ? "bg-accent-light text-accent font-medium"
            : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        )}
      >
        {conversation.pinned && (
          <Pin className="h-3 w-3 shrink-0 text-accent" />
        )}
        <span className="truncate flex-1">
          {truncate(conversation.title, 32)}
        </span>
      </button>

      {/* Three-dot menu */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className={cn(
          "absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md",
          "flex items-center justify-center text-text-muted",
          "opacity-0 group-hover:opacity-100 hover:bg-surface-alt hover:text-text-primary",
          "transition-all cursor-pointer"
        )}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {/* Dropdown */}
      {showMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute right-0 top-full mt-1 z-20 w-40 bg-surface border border-border rounded-xl shadow-lg py-1"
        >
          <button className="w-full px-3 py-1.5 text-xs text-left text-text-secondary hover:bg-surface-alt flex items-center gap-2 cursor-pointer">
            <Pin className="h-3 w-3" />
            {conversation.pinned ? "Открепить" : "Закрепить"}
          </button>
          <button className="w-full px-3 py-1.5 text-xs text-left text-text-secondary hover:bg-surface-alt flex items-center gap-2 cursor-pointer">
            <Archive className="h-3 w-3" />
            В архив
          </button>
          <button
            onClick={handleDelete}
            className="w-full px-3 py-1.5 text-xs text-left text-error hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
            Удалить
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
