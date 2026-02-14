"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ChatArea } from "@/components/chat/ChatArea";
import { useChatStore } from "@/stores/chatStore";

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { setActiveConversation, setMessages } = useChatStore();

  useEffect(() => {
    if (!id) return;
    setActiveConversation(id);

    // Fetch messages for this conversation
    fetch(`/api/conversations/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(
            data.messages.map(
              (m: {
                id: string;
                role: string;
                content: string;
                createdAt: string;
                planContent?: string;
                legalRefs?: unknown[];
                artifacts?: unknown[];
              }) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                planContent: m.planContent || undefined,
                createdAt: m.createdAt,
                legalRefs: m.legalRefs || [],
                artifacts: m.artifacts || [],
              })
            )
          );
        }
      })
      .catch(() => {
        setMessages([]);
      });
  }, [id, setActiveConversation, setMessages]);

  return <ChatArea />;
}
