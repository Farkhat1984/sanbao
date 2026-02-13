"use client";

import { PanelLeftOpen } from "lucide-react";
import { useSidebarStore } from "@/stores/sidebarStore";
import { useChatStore } from "@/stores/chatStore";
import { Tooltip } from "@/components/ui/Tooltip";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";

export function Header() {
  const { isOpen: sidebarOpen, open } = useSidebarStore();
  const { activeConversationId, conversations } = useChatStore();

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  return (
    <header className="h-14 border-b border-border flex items-center gap-3 px-4 shrink-0 bg-surface/50 backdrop-blur-sm">
      {/* Sidebar toggle (shown when sidebar is closed) */}
      {!sidebarOpen && (
        <Tooltip content="Открыть меню" side="bottom">
          <button
            onClick={open}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </Tooltip>
      )}

      {/* Chat Title */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {activeConv?.agentIcon && (() => {
          const AgentIcon = ICON_MAP[activeConv.agentIcon] || ICON_MAP.Bot;
          return (
            <div
              className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: activeConv.agentIconColor || "#4F6EF7" }}
            >
              <AgentIcon className="h-3.5 w-3.5 text-white" />
            </div>
          );
        })()}
        <h1 className="text-sm font-semibold text-text-primary truncate">
          {activeConv?.title || "Новый чат"}
        </h1>
      </div>
    </header>
  );
}
