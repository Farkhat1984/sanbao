"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pin, Trash2, Archive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";
import { cn, truncate } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { setActiveConversation, setActiveAgentId, removeConversation } = useChatStore();
  const { close: closeSidebar } = useSidebarStore();
  const router = useRouter();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const handleClick = () => {
    setActiveConversation(conversation.id);
    setActiveAgentId(conversation.agentId || null);
    router.push(`/chat/${conversation.id}`);
    if (isMobile) closeSidebar();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    removeConversation(conversation.id);
    fetch(`/api/conversations/${conversation.id}`, { method: "DELETE" }).catch(console.error);
    if (isActive) {
      setActiveConversation(null);
      setActiveAgentId(null);
      router.push("/chat");
    }
  };

  return (
    <div ref={menuRef} className="relative group">
      <button
        onClick={handleClick}
        className={cn(
          "w-full text-left px-2.5 py-2 pr-8 rounded-xl text-sm transition-all duration-150 cursor-pointer",
          "flex items-center gap-2",
          isActive
            ? "bg-accent-light text-accent font-medium"
            : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        )}
      >
        {conversation.pinned && (
          <Pin className="h-3 w-3 shrink-0 text-accent" />
        )}
        {conversation.agentId && conversation.agentIcon && (() => {
          const AgentIcon = ICON_MAP[conversation.agentIcon] || ICON_MAP.Bot;
          return (
            <div
              className="h-4 w-4 rounded shrink-0 flex items-center justify-center"
              style={{ backgroundColor: conversation.agentIconColor || "#6366f1" }}
              title={conversation.agentName || "Агент"}
            >
              <AgentIcon className="h-2.5 w-2.5 text-white" />
            </div>
          );
        })()}
        <span className="truncate flex-1">
          {truncate(conversation.title, 32)}
        </span>
      </button>

      {/* Three-dot menu — always visible on mobile */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className={cn(
          "absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md",
          "flex items-center justify-center text-text-muted",
          "transition-opacity cursor-pointer",
          "hover:bg-surface-alt hover:text-text-primary",
          isMobile
            ? "h-8 w-8 opacity-100"
            : "h-6 w-6 opacity-0 group-hover:opacity-100",
          showMenu && "opacity-100"
        )}
      >
        <MoreHorizontal className={isMobile ? "h-4 w-4" : "h-3.5 w-3.5"} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full z-20 w-40 bg-surface border border-border rounded-xl shadow-lg py-1"
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
              onClick={handleDeleteClick}
              className="w-full px-3 py-1.5 text-xs text-left text-error hover:bg-red-50 flex items-center gap-2 cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
              Удалить
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Удалить чат?"
        description="Все сообщения и документы этого чата будут удалены."
        confirmText="Удалить"
      />
    </div>
  );
}
