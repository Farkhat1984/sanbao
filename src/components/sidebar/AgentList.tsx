"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAgentStore } from "@/stores/agentStore";
import { useChatStore } from "@/stores/chatStore";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";
import { cn } from "@/lib/utils";

export function AgentList() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const { agents, setAgents } = useAgentStore();
  const { addConversation, setActiveConversation, setMessages, setActiveAgentId } =
    useChatStore();

  useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAgents(data);
      })
      .catch(() => {});
  }, [setAgents]);

  const handleAgentClick = async (agentId: string, agentName: string) => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Чат с ${agentName}`,
          agentId,
        }),
      });

      if (!res.ok) return;

      const conversation = await res.json();
      addConversation(conversation);
      setActiveConversation(conversation.id);
      setActiveAgentId(agentId);
      setMessages([]);
      router.push(`/chat/${conversation.id}`);
    } catch {
      // Ignore errors
    }
  };

  const visibleAgents = agents.slice(0, 5);

  return (
    <div className="px-3 mb-1">
      {/* Section Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 py-1.5 text-[11px] font-medium text-text-muted uppercase tracking-wider hover:text-text-primary transition-colors cursor-pointer"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        Мои агенты
      </button>

      {expanded && (
        <div className="space-y-0.5 mt-0.5">
          {visibleAgents.map((agent) => {
            const Icon = ICON_MAP[agent.icon] || ICON_MAP.Bot;
            return (
              <button
                key={agent.id}
                onClick={() => handleAgentClick(agent.id, agent.name)}
                className={cn(
                  "w-full h-8 rounded-lg flex items-center gap-2.5 px-2",
                  "text-text-muted hover:text-text-primary hover:bg-surface-alt",
                  "transition-colors cursor-pointer"
                )}
              >
                <div
                  className="h-5 w-5 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: agent.iconColor }}
                >
                  <Icon className="h-3 w-3 text-white" />
                </div>
                <span className="text-sm truncate">{agent.name}</span>
              </button>
            );
          })}

          {/* All agents / Create */}
          <div className="flex items-center gap-1 pt-0.5">
            {agents.length > 0 && (
              <>
                <button
                  onClick={() => router.push("/agents")}
                  className="text-[11px] text-text-muted hover:text-accent transition-colors cursor-pointer"
                >
                  Все агенты
                </button>
                <span className="text-text-muted text-[11px]">·</span>
              </>
            )}
            <button
              onClick={() => router.push("/agents/new")}
              className="text-[11px] text-text-muted hover:text-accent transition-colors flex items-center gap-0.5 cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              Создать агента
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
