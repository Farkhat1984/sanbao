"use client";

import { useRef } from "react";
import { ChatArea } from "@sanbao/ui/components/chat/ChatArea";
import { useChatStore } from "@/stores/chatStore";

export default function ChatPage() {
  const hasReset = useRef(false);

  // Reset state synchronously during render (not in useEffect) to prevent
  // a single frame of stale content before the WelcomeScreen appears.
  // The ref guard ensures we only do this once per mount.
  if (!hasReset.current) {
    hasReset.current = true;
    const state = useChatStore.getState();
    if (state.activeConversationId !== null || state.messages.length > 0) {
      useChatStore.setState({
        activeConversationId: null,
        messages: [],
        currentPlan: null,
        contextUsage: null,
        messagesCursor: null,
        hasMoreMessages: false,
        isLoadingConversation: false,
      });
    }
  }

  return <ChatArea />;
}
