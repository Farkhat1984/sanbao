"use client";

import { useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { ChatArea } from "@sanbao/ui/components/chat/ChatArea";
import { useChatStore } from "@/stores/chatStore";
import type { ChatMessage } from "@/types/chat";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMessages(raw: any[]): ChatMessage[] {
  return raw.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
    legalRefs: m.legalRefs || [],
    artifacts: m.artifacts || [],
  }));
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const wasStreamingRef = useRef(false);
  const loadedIdRef = useRef<string | null>(null);

  const isStreaming = useChatStore((s) => s.isStreaming);

  // Track streaming state for visibilitychange handler
  useEffect(() => {
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const fetchMessages = useCallback((conversationId: string) => {
    const store = useChatStore.getState();
    // Skip if already streaming — messages are being built in-memory.
    // They will be fetched from DB when streaming ends.
    if (store.isStreaming) {
      useChatStore.setState({ isLoadingConversation: false });
      return;
    }

    useChatStore.setState({ isLoadingConversation: true });

    fetch(`/api/conversations/${conversationId}?limit=50`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        // Verify this response is still for the active conversation
        const currentState = useChatStore.getState();
        if (currentState.activeConversationId !== conversationId) return;

        useChatStore.setState({
          activeAgentId: data.agentId || null,
          orgAgentId: data.orgAgentId || null,
          messages: data.messages && Array.isArray(data.messages)
            ? mapMessages(data.messages)
            : [],
          messagesCursor: data.nextCursor ?? null,
          hasMoreMessages: data.hasMore ?? false,
          isLoadingConversation: false,
        });
      })
      .catch(() => {
        const currentState = useChatStore.getState();
        if (currentState.activeConversationId !== conversationId) return;

        useChatStore.setState({
          activeAgentId: null,
          orgAgentId: null,
          messages: [],
          messagesCursor: null,
          hasMoreMessages: false,
          isLoadingConversation: false,
        });
      });
  }, []);

  // Set active conversation and load messages when ID changes.
  useEffect(() => {
    if (!id) return;

    const isNewConversation = loadedIdRef.current !== id;
    if (!isNewConversation) return;

    loadedIdRef.current = id;

    const store = useChatStore.getState();

    // If streaming is actively building messages for this conversation
    // (e.g., router.replace from useStreamChat after creating a new conversation),
    // do NOT clear messages — they're being built by the active stream.
    if (store.isStreaming && store.activeConversationId === id && store.messages.length > 0) {
      return;
    }

    // Different conversation or no messages yet — set loading and fetch.
    useChatStore.setState({
      activeConversationId: id,
      messages: [],
      isLoadingConversation: true,
      contextUsage: null,
      messagesCursor: null,
      hasMoreMessages: false,
    });

    fetchMessages(id);
  }, [id, fetchMessages]);

  // No re-fetch on stream end — messages are already merged in store by
  // setStreaming(false). Re-fetching caused race conditions: fetchMessages
  // set isLoadingConversation=true (flashing skeleton) and could overwrite
  // store with stale DB data if save hadn't completed yet.

  // Recover after mobile browser suspends the tab:
  // when the user returns and the stream was interrupted, re-fetch messages.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (wasStreamingRef.current && !useChatStore.getState().isStreaming && id) {
        fetchMessages(id);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchMessages, id]);

  return <ChatArea />;
}
