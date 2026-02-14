"use client";

import { useRef, useEffect, useState } from "react";
import { ListChecks, ChevronDown, ChevronRight } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useTaskStore } from "@/stores/taskStore";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { WelcomeScreen } from "./WelcomeScreen";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ContextIndicator } from "./ContextIndicator";
import { TaskPanel } from "@/components/tasks/TaskPanel";
import { ClarifyModal } from "./ClarifyModal";

export function ChatArea() {
  const { messages, isStreaming, streamingPhase, isToolWorking, activeToolName, contextUsage } = useChatStore();
  const { tasks } = useTaskStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [tasksExpanded, setTasksExpanded] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const hasMessages = messages.length > 0;
  const activeTasks = tasks.filter((t) => t.status === "IN_PROGRESS");

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
              />
            ))}

            {/* Thinking / Tool Working Indicator */}
            {(isStreaming || isToolWorking) && (
              <ThinkingIndicator
                phase={streamingPhase}
                isToolWorking={isToolWorking}
                toolName={activeToolName}
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
