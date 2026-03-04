"use client";

import { useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { ChatArea } from "@/components/chat/ChatArea";
import { useChatStore } from "@/stores/chatStore";
import type { ChatMessage } from "@/types/chat";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMessages(raw: any[]): ChatMessage[] {
  return raw.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    planContent: m.planContent || undefined,
    createdAt: m.createdAt,
    legalRefs: m.legalRefs || [],
    artifacts: m.artifacts || [],
  }));
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { setActiveConversation, setActiveAgentId, setMessages } = useChatStore();
  const isStreaming = useChatStore((s) => s.isStreaming);
  const wasStreamingRef = useRef(false);

  // Track streaming state for visibilitychange handler
  useEffect(() => {
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const fetchMessages = useCallback(() => {
    if (!id) return;
    fetch(`/api/conversations/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        setActiveAgentId(data.agentId || null);
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(mapMessages(data.messages));
        }
      })
      .catch(() => {
        setActiveAgentId(null);
        setMessages([]);
      });
  }, [id, setActiveAgentId, setMessages]);

  // Load messages on mount (skip if streaming)
  useEffect(() => {
    if (!id) return;
    setActiveConversation(id);
    if (isStreaming) return;
    fetchMessages();
  }, [id, isStreaming, setActiveConversation, fetchMessages]);

  // Recover after mobile browser suspends the tab:
  // when the user returns and the stream was interrupted, re-fetch messages from DB.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      // Stream was active before tab was hidden but is now dead — recover
      if (wasStreamingRef.current && !useChatStore.getState().isStreaming) {
        fetchMessages();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchMessages]);

  return <ChatArea />;
}
