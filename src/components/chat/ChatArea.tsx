"use client";

import { useRef, useEffect } from "react";
import { useChatStore } from "@/stores/chatStore";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { WelcomeScreen } from "./WelcomeScreen";
import { ThinkingIndicator } from "./ThinkingIndicator";

export function ChatArea() {
  const { messages, isStreaming, streamingPhase, isToolWorking, activeToolName } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const hasMessages = messages.length > 0;

  return (
    <div className="h-full flex flex-col">
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

      {/* Input */}
      <div className="shrink-0 pb-4 px-4">
        <div className="max-w-3xl mx-auto">
          <MessageInput />
        </div>
      </div>
    </div>
  );
}
