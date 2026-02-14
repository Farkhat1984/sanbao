"use client";

import { useRef, useEffect, useState } from "react";
import { ListChecks, ChevronDown, ChevronRight } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useAgentStore } from "@/stores/agentStore";
import { useTaskStore } from "@/stores/taskStore";
import { isSystemAgent } from "@/lib/system-agents";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { WelcomeScreen } from "./WelcomeScreen";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ContextIndicator } from "./ContextIndicator";
import { TaskPanel } from "@/components/tasks/TaskPanel";
import { ClarifyModal } from "./ClarifyModal";

export function ChatArea() {
  const { messages, isStreaming, streamingPhase, contextUsage, activeConversationId, activeAgentId, conversations } = useChatStore();
  const { setActiveAgent } = useAgentStore();
  const { tasks } = useTaskStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [tasksExpanded, setTasksExpanded] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Load full agent data when activeAgentId changes
  useEffect(() => {
    if (!activeAgentId || isSystemAgent(activeAgentId)) {
      setActiveAgent(null);
      return;
    }

    fetch(`/api/agents/${activeAgentId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((agent) => setActiveAgent(agent))
      .catch(() => setActiveAgent(null));
  }, [activeAgentId, setActiveAgent]);

  const hasMessages = messages.length > 0;
  const activeTasks = tasks.filter((t) => t.status === "IN_PROGRESS");

  // Agent info from active conversation
  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const agentName = activeConv?.agentName ?? undefined;
  const agentIcon = activeConv?.agentIcon ?? undefined;
  const agentIconColor = activeConv?.agentIconColor ?? undefined;

  return (
    <div className="h-full flex flex-col">
      {/* Active tasks indicator */}
      {activeTasks.length > 0 && (
        <div className="shrink-0 px-4 pt-2">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => setTasksExpanded(!tasksExpanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/15 transition-colors cursor-pointer"
            >
              {tasksExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <ListChecks className="h-3.5 w-3.5" />
              {activeTasks.length} {activeTasks.length === 1 ? "задача" : "задачи"} в работе
            </button>
            {tasksExpanded && (
              <div className="mt-2 mb-1 max-h-48 overflow-y-auto">
                <TaskPanel />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages or Welcome */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <WelcomeScreen />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-1">
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isLast={i === messages.length - 1}
                agentName={agentName}
                agentIcon={agentIcon}
                agentIconColor={agentIconColor}
              />
            ))}

            {/* Thinking / Streaming Indicator */}
            {isStreaming && streamingPhase && (
              <ThinkingIndicator
                phase={streamingPhase}
                agentName={agentName}
              />
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Context indicator + Input */}
      <div className="shrink-0 pb-4 px-4">
        <div className="max-w-3xl mx-auto">
          {contextUsage && (
            <ContextIndicator
              usagePercent={contextUsage.usagePercent}
              isCompacting={contextUsage.isCompacting}
            />
          )}
          <MessageInput />
        </div>
      </div>

      <ClarifyModal />
    </div>
  );
}
