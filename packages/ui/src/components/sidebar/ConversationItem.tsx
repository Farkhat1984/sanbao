"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pin, Network } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";
import { cn, truncate } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTranslation } from "@/hooks/useTranslation";
import { ConversationContextMenu } from "./ConversationContextMenu";
import { DeleteConfirmation } from "./DeleteConfirmation";
import type { ConversationSummary } from "@/types/chat";

interface ConversationItemProps {
  conversation: ConversationSummary;
  isActive: boolean;
  isArchived?: boolean;
  onUnarchive?: (id: string) => void;
}

export const ConversationItem = memo(function ConversationItem({
  conversation,
  isActive,
  isArchived,
  onUnarchive,
}: ConversationItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { setActiveConversation, setActiveAgentId, removeConversation } = useChatStore();
  const { close: closeSidebar } = useSidebarStore();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const openMenu = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = 120; // approximate dropdown height
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom + 4;
      const left = Math.max(8, rect.right - 160); // 160 = w-40
      setMenuPos({ top, left });
    }
    setShowMenu(true);
  }, []);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
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

  const handlePinToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    const newPinned = !conversation.pinned;
    // Optimistic update via store
    useChatStore.setState((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversation.id ? { ...c, pinned: newPinned } : c
      ),
    }));
    fetch(`/api/conversations/${conversation.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: newPinned }),
    }).catch(console.error);
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    // Remove from list immediately
    removeConversation(conversation.id);
    fetch(`/api/conversations/${conversation.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    }).catch(console.error);
    if (isActive) {
      setActiveConversation(null);
      setActiveAgentId(null);
      router.push("/chat");
    }
  };

  const handleUnarchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    useChatStore.getState().addConversation(conversation);
    fetch(`/api/conversations/${conversation.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    }).catch(console.error);
    onUnarchive?.(conversation.id);
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
    <div className="relative group">
      <button
        onClick={handleClick}
        aria-current={isActive ? "page" : undefined}
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
              style={{ backgroundColor: conversation.agentIconColor || "#8FAF9F" }}
              title={conversation.agentName || t("sidebar.agent")}
            >
              <AgentIcon className="h-2.5 w-2.5 text-white" />
            </div>
          );
        })()}
        {conversation.isSwarmMode && (
          <div
            className="h-4 w-4 rounded shrink-0 flex items-center justify-center bg-amber-500/10"
            title={t("sidebar.multiAgent")}
          >
            <Network className="h-2.5 w-2.5 text-amber-500" />
          </div>
        )}
        <span className="truncate flex-1">
          {truncate(conversation.title, 32)}
        </span>
      </button>

      {/* Three-dot menu — always visible on mobile */}
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          if (showMenu) setShowMenu(false);
          else openMenu();
        }}
        aria-label={t("sidebar.chatMenu")}
        title={t("sidebar.chatMenu")}
        className={cn(
          "absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md",
          "flex items-center justify-center text-text-secondary",
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

      {/* Dropdown — rendered via portal to escape overflow:hidden containers */}
      <ConversationContextMenu
        showMenu={showMenu}
        menuPos={menuPos}
        menuRef={menuRef}
        isArchived={isArchived}
        pinned={conversation.pinned}
        onPinToggle={handlePinToggle}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
        onDeleteClick={handleDeleteClick}
      />

      <DeleteConfirmation
        isOpen={showDeleteConfirm}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
});
