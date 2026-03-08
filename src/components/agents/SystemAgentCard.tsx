"use client";

import { ChatTeardrop, Shield } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/stores/chatStore";
import { ICON_MAP } from "./AgentIconPicker";

interface SystemAgentInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconColor: string;
}

interface SystemAgentCardProps {
  agent: SystemAgentInfo;
}

export function SystemAgentCard({ agent }: SystemAgentCardProps) {
  const router = useRouter();
  const { addConversation, setActiveConversation, setMessages, setActiveAgentId } =
    useChatStore();

  const Icon = ICON_MAP[agent.icon] || ICON_MAP.Bot;

  const handleStartChat = async () => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Чат с ${agent.name}`,
          agentId: agent.id,
        }),
      });

      if (!res.ok) return;

      const conversation = await res.json();
      addConversation(conversation);
      setActiveConversation(conversation.id);
      setActiveAgentId(agent.id);
      setMessages([]);
      router.push(`/chat/${conversation.id}`);
    } catch {
      // Ignore errors
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative p-5 rounded-2xl border border-border bg-surface transition-all duration-200"
    >
      {/* System badge */}
      <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-legal-ref/10 text-legal-ref">
        <Shield weight="duotone" className="h-2.5 w-2.5" />
        <span className="text-[9px] font-semibold uppercase tracking-wider">Системный</span>
      </div>

      <div className="flex items-start gap-3 mb-3">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-md bg-accent"
        >
          <Icon weight="duotone" className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">
            {agent.name}
          </h3>
          <p className="text-xs text-legal-ref mt-0.5">
            Системный агент
          </p>
        </div>
      </div>

      <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-4">
        {agent.description}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-legal-ref/20">
        <div className="flex items-center gap-1 text-[10px] text-text-secondary">
          <Shield weight="duotone" className="h-3 w-3" />
          Доступен всем
        </div>
        <button
          onClick={handleStartChat}
          className="h-7 px-3 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <ChatTeardrop weight="duotone" className="h-3 w-3" />
            Начать чат
          </span>
        </button>
      </div>
    </motion.div>
  );
}
