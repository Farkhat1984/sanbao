"use client";

import { useEffect, useRef } from "react";
import {
  Plus,
  Search,
  PanelLeftClose,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { SanbaoCompass } from "@/components/ui/SanbaoCompass";
import { useSidebarStore } from "@/stores/sidebarStore";
import { useChatStore } from "@/stores/chatStore";
import { ConversationList } from "./ConversationList";
import { AgentList } from "./AgentList";
import { Avatar } from "@/components/ui/Avatar";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";

export function Sidebar() {
  const { close, searchQuery, setSearchQuery } = useSidebarStore();
  const { setActiveConversation, setActiveAgentId, setMessages, setConversations, isStreaming } = useChatStore();
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();

  // Load conversations from DB on mount
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setConversations(data);
      })
      .catch(console.error);
  }, [session?.user, setConversations]);

  // Auto-close sidebar on route change (mobile only) — skip initial mount
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      if (isMobile) {
        close();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleNewChat = () => {
    setActiveConversation(null);
    setActiveAgentId(null);
    setMessages([]);
    router.push("/chat");
    if (isMobile) close();
  };

  const handleNavigate = (path: string) => {
    router.push(path);
    if (isMobile) close();
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border",
        "glass select-none shrink-0",
        isMobile ? "w-full h-full" : "w-[280px] h-screen"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-3 h-14 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-accent to-legal-ref flex items-center justify-center shrink-0 text-white">
            <SanbaoCompass size={20} state={isStreaming ? "loading" : "idle"} />
          </div>
          <span className="font-semibold text-text-primary text-base tracking-tight">
            Sanbao
          </span>
        </div>

        <Tooltip content="Закрыть" side="right">
          <button
            onClick={close}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>

      {/* New Chat Button */}
      <div className="px-3 mb-1">
        <button
          onClick={handleNewChat}
          className="w-full h-9 rounded-xl bg-accent text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-accent-hover transition-all shadow-sm active:scale-[0.98] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Новый чат
        </button>
      </div>

      {/* Agents */}
      <AgentList />

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Поиск чатов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-surface-alt border border-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-hover transition-colors"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <ConversationList />
      </div>

      {/* Footer */}
      <div className={cn("border-t border-border p-3 shrink-0", isMobile && "safe-bottom")}>
        <div className="flex items-center gap-2">
          <Avatar
            src={session?.user?.image}
            name={session?.user?.name}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {session?.user?.name || "Гость"}
            </p>
            <p className="text-xs text-text-muted truncate">
              {session?.user?.email || "Войдите в аккаунт"}
            </p>
          </div>
          {session?.user?.role === "ADMIN" && (
            <Tooltip content="Админ" side="top">
              <button
                onClick={() => handleNavigate("/admin")}
                className={cn(
                  "rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer",
                  isMobile ? "h-10 w-10" : "h-8 w-8"
                )}
              >
                <ShieldCheck className="h-4 w-4" />
              </button>
            </Tooltip>
          )}
          <Tooltip content="Настройки" side="top">
            <button
              onClick={() => handleNavigate("/settings")}
              className={cn(
                "rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer",
                isMobile ? "h-10 w-10" : "h-8 w-8"
              )}
            >
              <Settings className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
