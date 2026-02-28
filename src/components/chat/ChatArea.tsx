"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { ListChecks, ChevronDown, ChevronRight } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useAgentStore } from "@/stores/agentStore";
import { useTaskStore } from "@/stores/taskStore";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { WelcomeScreen } from "./WelcomeScreen";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ContextIndicator } from "./ContextIndicator";
import { TaskPanel } from "@/components/tasks/TaskPanel";
import { ClarifyModal } from "./ClarifyModal";
import { SanbaoFact } from "./SanbaoFact";

export function ChatArea() {
  const { messages, isStreaming, streamingPhase, streamingToolName, contextUsage, activeConversationId, activeAgentId, conversations, setPendingInput } = useChatStore();
  const { setActiveAgent, setAgentTools } = useAgentStore();
  const { tasks } = useTaskStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [tasksExpanded, setTasksExpanded] = useState(false);

  // Auto-scroll: use instant scroll during streaming (smooth can't keep up
  // with rapid chunk updates and animations cancel each other), smooth otherwise.
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isStreaming) {
      // During streaming, scroll the container directly for reliable tracking
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming, streamingPhase]);

  // Load full agent data when activeAgentId changes
  useEffect(() => {
    if (!activeAgentId) {
      setActiveAgent(null);
      setAgentTools([]);
      return;
    }

    // Load agent info
    fetch(`/api/agents/${activeAgentId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((agent) => setActiveAgent(agent))
      .catch(() => setActiveAgent(null));

    // Load agent tools
    fetch(`/api/agents/${activeAgentId}/tools`)
      .then((r) => (r.ok ? r.json() : []))
      .then((tools) => setAgentTools(Array.isArray(tools) ? tools : []))
      .catch(() => setAgentTools([]));
  }, [activeAgentId, setActiveAgent, setAgentTools]);

  const hasMessages = messages.length > 0;
  const activeTasks = tasks.filter((t) => t.status === "IN_PROGRESS");

  // Agent info from active conversation
  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const agentName = activeConv?.agentName ?? undefined;
  const agentIcon = activeConv?.agentIcon ?? undefined;
  const agentIconColor = activeConv?.agentIconColor ?? undefined;

  // Retry: find the user message before the given assistant message and re-submit it
  const handleRetry = useCallback((assistantMessageId: string) => {
    const idx = messages.findIndex((m) => m.id === assistantMessageId);
    if (idx <= 0) return;
    // Walk backwards to find the preceding user message
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === "USER" && messages[i].content.trim()) {
        setPendingInput(messages[i].content);
        break;
      }
    }
  }, [messages, setPendingInput]);

  return (
    <div className="h-full flex flex-col">
      {/* Active tasks indicator */}
      {activeTasks.length > 0 && (
        <div className="shrink-0 px-4 pt-2">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => setTasksExpanded(!tasksExpanded)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/15 transition-colors cursor-pointer"
            >
              {tasksExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <ListChecks className="h-3.5 w-3.5" />
              <span>{activeTasks.length} {activeTasks.length === 1 ? "задача" : "задачи"} в работе</span>
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
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto" role="log" aria-live="polite" aria-label="Сообщения чата">
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
                onRetry={handleRetry}
              />
            ))}

            {/* Thinking / Streaming Indicator */}
            {isStreaming && streamingPhase && (
              <ThinkingIndicator
                phase={streamingPhase}
                agentName={agentName}
                toolName={streamingToolName}
              />
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Context indicator + Input */}
      <div className="shrink-0 pb-4 px-4 safe-bottom">
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

      {/* Historical facts about Zheng He during loading */}
      <SanbaoFact
        isVisible={isStreaming && !!streamingPhase}
        messageCount={messages.length}
      />
    </div>
  );
}
