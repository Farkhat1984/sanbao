"use client";

import { PanelLeftOpen, PanelRightOpen, PanelRightClose, Sparkles } from "lucide-react";
import { useSidebarStore } from "@/stores/sidebarStore";
import { useArtifactStore } from "@/stores/artifactStore";
import { useChatStore } from "@/stores/chatStore";
import { Tooltip } from "@/components/ui/Tooltip";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export function Header() {
  const { isOpen: sidebarOpen, open } = useSidebarStore();
  const { isOpen: artifactOpen, closePanel, activeArtifact } = useArtifactStore();
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
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-text-primary truncate">
          {activeConv?.title || "Новый чат"}
        </h1>
      </div>

      {/* Pro Mode Badge */}
      <Badge variant="accent" className="cursor-pointer hover:opacity-80 transition-opacity">
        <Sparkles className="h-3 w-3" />
        Pro
      </Badge>

      {/* Artifact Panel Toggle */}
      <Tooltip content={artifactOpen ? "Скрыть панель" : "Показать панель"} side="bottom">
        <button
          onClick={() => artifactOpen ? closePanel() : undefined}
          disabled={!activeArtifact && !artifactOpen}
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
            artifactOpen
              ? "text-accent bg-accent-light"
              : "text-text-muted hover:text-text-primary hover:bg-surface-alt",
            !activeArtifact && !artifactOpen && "opacity-40 cursor-not-allowed"
          )}
        >
          {artifactOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRightOpen className="h-4 w-4" />
          )}
        </button>
      </Tooltip>
    </header>
  );
}
