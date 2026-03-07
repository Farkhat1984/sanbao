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
  const { setActiveConversation, setActiveAgentId, setOrgAgentId, setMessages, setMessagesPagination } = useChatStore();
  const isStreaming = useChatStore((s) => s.isStreaming);
  const wasStreamingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  // Track streaming state for visibilitychange handler
  useEffect(() => {
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const fetchMessages = useCallback(() => {
    if (!id) return;
    fetch(`/api/conversations/${id}?limit=50`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        setActiveAgentId(data.agentId || null);
        setOrgAgentId(data.orgAgentId || null);
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(mapMessages(data.messages));
        }
        // Store pagination state for "load older" functionality
        setMessagesPagination(data.nextCursor ?? null, data.hasMore ?? false);
      })
      .catch(() => {
        setActiveAgentId(null);
        setOrgAgentId(null);
        setMessages([]);
        setMessagesPagination(null, false);
      });
  }, [id, setActiveAgentId, setOrgAgentId, setMessages, setMessagesPagination]);

  // Load messages on mount only — NOT when isStreaming changes.
  // This prevents a race where fetchMessages() runs before the
  // fire-and-forget DB save completes, overwriting the streamed message.
  useEffect(() => {
    if (!id) return;
    setActiveConversation(id);
    if (isStreaming) return;
    // Only fetch on initial mount, not after streaming ends
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      fetchMessages();
    }
  }, [id, isStreaming, setActiveConversation, fetchMessages]);

  // Reset loaded flag when conversation changes
  useEffect(() => {
    hasLoadedRef.current = false;
  }, [id]);

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
