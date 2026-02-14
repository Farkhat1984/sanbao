"use client";

import { MessageSquare, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/stores/chatStore";
import { ICON_MAP } from "./AgentIconPicker";
import type { AgentSummary } from "@/types/agent";

interface AgentCardProps {
  agent: AgentSummary;
}

export function AgentCard({ agent }: AgentCardProps) {
  const router = useRouter();
  const { addConversation, setActiveConversation, setMessages, setActiveAgentId } =
    useChatStore();

  const Icon = ICON_MAP[agent.icon] || ICON_MAP.Bot;

  const handleStartChat = async (e: React.MouseEvent) => {
    e.stopPropagation();

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
      className="group p-5 rounded-2xl border border-border bg-surface hover:border-border-hover transition-all duration-200 cursor-pointer"
      onClick={() => router.push(`/agents/${agent.id}/edit`)}
    >
      <div className="flex items-start gap-3 mb-3">
        {agent.avatar ? (
          <img
            src={agent.avatar}
            alt={agent.name}
            className="h-10 w-10 rounded-xl object-cover shrink-0"
          />
        ) : (
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: agent.iconColor }}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">
            {agent.name}
          </h3>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/agents/${agent.id}/edit`);
          }}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      {agent.description && (
        <p className="text-xs text-text-muted leading-relaxed line-clamp-2 mb-4">
          {agent.description}
        </p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-1 text-xs text-text-muted">
          <MessageSquare className="h-3 w-3" />
          {agent._count.conversations} чат{agent._count.conversations === 1 ? "" : "ов"}
        </div>
        <button
          onClick={handleStartChat}
          className="h-7 px-3 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors cursor-pointer"
        >
          Начать чат
        </button>
      </div>
    </motion.div>
  );
}
