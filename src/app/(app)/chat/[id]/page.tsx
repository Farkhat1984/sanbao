"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ChatArea } from "@/components/chat/ChatArea";
import { useChatStore } from "@/stores/chatStore";

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { setActiveConversation } = useChatStore();

  useEffect(() => {
    if (id) {
      setActiveConversation(id);
      // TODO: fetch messages for this conversation
    }
  }, [id, setActiveConversation]);

  return <ChatArea />;
}
