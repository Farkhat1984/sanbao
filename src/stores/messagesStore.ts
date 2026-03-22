import { create } from "zustand";
import type { ChatMessage, ConversationSummary } from "@/types/chat";

/** Maximum conversations kept in memory to prevent unbounded growth */
const MAX_CONVERSATIONS = 500;

export interface ClarifyQuestion {
  id: string;
  question: string;
  options?: string[];
  type?: "select" | "text";
  placeholder?: string;
}

export interface ContextUsage {
  usagePercent: number;
  totalTokens: number;
  contextWindowSize: number;
  isCompacting: boolean;
}

export interface SwarmAgentResponse {
  id: string;
  name: string;
  icon?: string;
  content: string;
}

interface MessagesState {
  // Active conversation
  activeConversationId: string | null;
  activeAgentId: string | null;
  orgAgentId: string | null;

  // Swarm / multi-agent
  swarmMode: boolean;
  swarmOrgId: string | null;
  multiAgentId: string | null;
  swarmAgentResponses: SwarmAgentResponse[];

  // Data
  conversations: ConversationSummary[];
  messages: ChatMessage[];

  // Planning
  currentPlan: string | null;

  // Context
  contextUsage: ContextUsage | null;

  // Pending input (from tools/templates)
  pendingInput: string | null;

  // Clarify questions modal
  clarifyQuestions: ClarifyQuestion[] | null;

  // Conversation pagination
  conversationsCursor: string | null;
  hasMoreConversations: boolean;
  isLoadingMoreConversations: boolean;

  // Message pagination
  messagesCursor: string | null;
  hasMoreMessages: boolean;
  isLoadingMoreMessages: boolean;

  /** True while fetching conversation messages (skeleton state) */
  isLoadingConversation: boolean;

  // Actions — swarm
  setSwarmMode: (orgId: string | null, multiAgentId?: string | null) => void;
  setMultiAgentId: (id: string | null) => void;
  addSwarmAgentResponse: (resp: SwarmAgentResponse) => void;
  clearSwarmAgentResponses: () => void;

  // Actions — conversations
  setActiveConversation: (id: string | null) => void;
  setActiveAgentId: (id: string | null) => void;
  setOrgAgentId: (id: string | null) => void;
  setConversations: (conversations: ConversationSummary[], nextCursor?: string | null) => void;
  appendConversations: (conversations: ConversationSummary[], nextCursor: string | null) => void;
  addConversation: (conversation: ConversationSummary) => void;
  removeConversation: (id: string) => void;
  setIsLoadingMoreConversations: (loading: boolean) => void;

  // Actions — messages
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  /** Prepend older messages to the beginning of the list */
  prependMessages: (messages: ChatMessage[], nextCursor: string | null) => void;
  setIsLoadingMoreMessages: (loading: boolean) => void;
  setIsLoadingConversation: (loading: boolean) => void;
  setMessagesPagination: (cursor: string | null, hasMore: boolean) => void;

  // Actions — planning
  setCurrentPlan: (plan: string | null) => void;
  updateCurrentPlan: (content: string) => void;

  // Actions — context
  setContextUsage: (usage: ContextUsage | null) => void;

  // Actions — pending input
  setPendingInput: (input: string | null) => void;

  // Actions — clarify
  setClarifyQuestions: (questions: ClarifyQuestion[] | null) => void;
}

export const useMessagesStore = create<MessagesState>((set) => ({
  activeConversationId: null,
  activeAgentId: null,
  orgAgentId: null,
  swarmMode: false,
  swarmOrgId: null,
  multiAgentId: null,
  swarmAgentResponses: [],
  conversations: [],
  messages: [],
  currentPlan: null,
  contextUsage: null,
  pendingInput: null,
  clarifyQuestions: null,

  conversationsCursor: null,
  hasMoreConversations: false,
  isLoadingMoreConversations: false,

  messagesCursor: null,
  hasMoreMessages: false,
  isLoadingMoreMessages: false,
  isLoadingConversation: false,

  setActiveConversation: (activeConversationId) =>
    set(activeConversationId === null
      ? { activeConversationId, messages: [], currentPlan: null, contextUsage: null, messagesCursor: null, hasMoreMessages: false, isLoadingConversation: false }
      : { activeConversationId }),

  setActiveAgentId: (activeAgentId) => set({ activeAgentId }),
  setOrgAgentId: (orgAgentId) => set({ orgAgentId }),
  setSwarmMode: (orgId, multiAgentId) => set({ swarmMode: !!orgId, swarmOrgId: orgId, multiAgentId: multiAgentId ?? null, orgAgentId: null }),
  setMultiAgentId: (multiAgentId) => set({ multiAgentId }),
  addSwarmAgentResponse: (resp) => set((s) => ({ swarmAgentResponses: [...s.swarmAgentResponses, resp] })),
  clearSwarmAgentResponses: () => set({ swarmAgentResponses: [] }),

  setConversations: (conversations, nextCursor) =>
    set({
      conversations: conversations.slice(0, MAX_CONVERSATIONS),
      conversationsCursor: nextCursor ?? null,
      hasMoreConversations: !!nextCursor,
    }),

  appendConversations: (conversations, nextCursor) =>
    set((s) => {
      const updated = [...s.conversations, ...conversations];
      return {
        conversations: updated.length > MAX_CONVERSATIONS ? updated.slice(0, MAX_CONVERSATIONS) : updated,
        conversationsCursor: nextCursor,
        hasMoreConversations: !!nextCursor,
        isLoadingMoreConversations: false,
      };
    }),

  addConversation: (conversation) =>
    set((s) => {
      const updated = [conversation, ...s.conversations];
      return { conversations: updated.length > MAX_CONVERSATIONS ? updated.slice(0, MAX_CONVERSATIONS) : updated };
    }),

  removeConversation: (id) =>
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeConversationId:
        s.activeConversationId === id ? null : s.activeConversationId,
    })),

  setIsLoadingMoreConversations: (isLoadingMoreConversations) =>
    set({ isLoadingMoreConversations }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message] })),

  prependMessages: (olderMessages, nextCursor) =>
    set((s) => ({
      messages: [...olderMessages, ...s.messages],
      messagesCursor: nextCursor,
      hasMoreMessages: !!nextCursor,
      isLoadingMoreMessages: false,
    })),

  setIsLoadingMoreMessages: (isLoadingMoreMessages) =>
    set({ isLoadingMoreMessages }),

  setIsLoadingConversation: (isLoadingConversation) =>
    set({ isLoadingConversation }),

  setMessagesPagination: (messagesCursor, hasMoreMessages) =>
    set({ messagesCursor, hasMoreMessages }),

  setCurrentPlan: (currentPlan) => set({ currentPlan }),

  updateCurrentPlan: (content) =>
    set((s) => ({ currentPlan: (s.currentPlan || "") + content })),

  setContextUsage: (contextUsage) => set({ contextUsage }),

  setPendingInput: (pendingInput) => set({ pendingInput }),

  setClarifyQuestions: (clarifyQuestions) => set({ clarifyQuestions }),
}));
