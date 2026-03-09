import { create } from "zustand";
import type { ChatMessage, ConversationSummary } from "@/types/chat";
import { PHASE_PRIORITY } from "@/lib/chat/tool-categories";

/** Maximum conversations kept in memory to prevent unbounded growth */
const MAX_CONVERSATIONS = 500;

export type StreamingPhase = "thinking" | "searching" | "using_tool" | "planning" | "answering" | "routing" | "consulting" | "synthesizing" | null;

export interface ClarifyQuestion {
  id: string;
  question: string;
  options?: string[];
  type?: "select" | "text";
  placeholder?: string;
}

interface ContextUsage {
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

interface ChatState {
  activeConversationId: string | null;
  activeAgentId: string | null;
  orgAgentId: string | null;
  swarmMode: boolean;
  swarmOrgId: string | null;
  multiAgentId: string | null;
  swarmAgentResponses: SwarmAgentResponse[];
  conversations: ConversationSummary[];
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingPhase: StreamingPhase;
  streamingToolName: string | null;

  // Streaming content buffer (merged into messages when stream ends)
  streamingContent: string | null;
  streamingReasoning: string | null;
  streamingPlanContent: string | null;

  // AI feature toggles
  provider: string;
  thinkingEnabled: boolean;
  webSearchEnabled: boolean;
  planningEnabled: boolean;

  // Planning mode
  currentPlan: string | null;

  // Autocompact
  contextUsage: ContextUsage | null;

  // Conversation pagination
  conversationsCursor: string | null;
  hasMoreConversations: boolean;
  isLoadingMoreConversations: boolean;

  // Message pagination
  messagesCursor: string | null;
  hasMoreMessages: boolean;
  isLoadingMoreMessages: boolean;

  setSwarmMode: (orgId: string | null, multiAgentId?: string | null) => void;
  setMultiAgentId: (id: string | null) => void;
  addSwarmAgentResponse: (resp: SwarmAgentResponse) => void;
  clearSwarmAgentResponses: () => void;

  setActiveConversation: (id: string | null) => void;
  setActiveAgentId: (id: string | null) => void;
  setOrgAgentId: (id: string | null) => void;
  setConversations: (conversations: ConversationSummary[], nextCursor?: string | null) => void;
  appendConversations: (conversations: ConversationSummary[], nextCursor: string | null) => void;
  addConversation: (conversation: ConversationSummary) => void;
  removeConversation: (id: string) => void;
  setIsLoadingMoreConversations: (loading: boolean) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  /** Prepend older messages to the beginning of the list */
  prependMessages: (messages: ChatMessage[], nextCursor: string | null) => void;
  setIsLoadingMoreMessages: (loading: boolean) => void;
  setMessagesPagination: (cursor: string | null, hasMore: boolean) => void;
  updateLastAssistantMessage: (content: string, reasoning?: string, planContent?: string) => void;
  /** Get the latest content for the last assistant message (streaming or committed) */
  getLastAssistantContent: () => { content: string; reasoning?: string; planContent?: string } | null;
  setStreaming: (isStreaming: boolean) => void;
  setStreamingPhase: (phase: StreamingPhase, toolName?: string | null) => void;

  setProvider: (provider: string) => void;
  toggleThinking: () => void;
  toggleWebSearch: () => void;
  togglePlanning: () => void;

  // Planning
  setCurrentPlan: (plan: string | null) => void;
  updateCurrentPlan: (content: string) => void;

  // Context
  setContextUsage: (usage: ContextUsage | null) => void;

  // Pending input (from tools/templates)
  pendingInput: string | null;
  setPendingInput: (input: string | null) => void;

  // Clarify questions modal
  clarifyQuestions: ClarifyQuestion[] | null;
  setClarifyQuestions: (questions: ClarifyQuestion[] | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeConversationId: null,
  activeAgentId: null,
  orgAgentId: null,
  swarmMode: false,
  swarmOrgId: null,
  multiAgentId: null,
  swarmAgentResponses: [],
  conversations: [],
  messages: [],
  isStreaming: false,
  streamingPhase: null,
  streamingToolName: null,
  streamingContent: null,
  streamingReasoning: null,
  streamingPlanContent: null,
  provider: "default",
  thinkingEnabled: false,
  webSearchEnabled: false,
  planningEnabled: false,

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

  setActiveConversation: (activeConversationId) =>
    set(activeConversationId === null
      ? { activeConversationId, messages: [], currentPlan: null, contextUsage: null, messagesCursor: null, hasMoreMessages: false }
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

  setMessagesPagination: (messagesCursor, hasMoreMessages) =>
    set({ messagesCursor, hasMoreMessages }),

  updateLastAssistantMessage: (content, reasoning, planContent) =>
    set({
      streamingContent: content,
      ...(reasoning !== undefined ? { streamingReasoning: reasoning } : {}),
      ...(planContent !== undefined ? { streamingPlanContent: planContent } : {}),
    }),

  getLastAssistantContent: () => {
    const s = get();
    if (s.streamingContent !== null) {
      return {
        content: s.streamingContent,
        reasoning: s.streamingReasoning ?? undefined,
        planContent: s.streamingPlanContent ?? undefined,
      };
    }
    return null;
  },

  setStreaming: (isStreaming) =>
    set((s) => {
      if (!isStreaming && s.streamingContent !== null) {
        // Merge streaming buffer into messages when stream ends
        const msgs = [...s.messages];
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === "ASSISTANT") {
            msgs[i] = {
              ...msgs[i],
              content: s.streamingContent!,
              ...(s.streamingReasoning !== null ? { reasoning: s.streamingReasoning } : {}),
              ...(s.streamingPlanContent !== null ? { planContent: s.streamingPlanContent } : {}),
            };
            break;
          }
        }
        return {
          isStreaming: false,
          streamingPhase: null,
          streamingToolName: null,
          streamingContent: null,
          streamingReasoning: null,
          streamingPlanContent: null,
          messages: msgs,
        };
      }
      return { isStreaming, ...(isStreaming ? {} : { streamingPhase: null, streamingToolName: null }) };
    }),

  setStreamingPhase: (phase, toolName) => {
    if (!phase) {
      set({ streamingPhase: null, streamingToolName: null });
      return;
    }
    // searching is an overlay — always allowed
    if (phase === "searching") {
      set({ streamingPhase: phase, streamingToolName: toolName ?? null });
      return;
    }
    const s = get();
    const curr = s.streamingPhase ? PHASE_PRIORITY[s.streamingPhase] || 0 : 0;
    const next = PHASE_PRIORITY[phase] || 0;
    if (next > curr) {
      set({ streamingPhase: phase, streamingToolName: toolName ?? null });
    }
    // If phase priority is not higher, do nothing (no empty set({}) call)
  },

  setProvider: (provider) => set({ provider }),
  toggleThinking: () => set((s) => ({ thinkingEnabled: !s.thinkingEnabled })),
  toggleWebSearch: () => set((s) => ({ webSearchEnabled: !s.webSearchEnabled })),
  togglePlanning: () => set((s) => ({ planningEnabled: !s.planningEnabled })),

  setCurrentPlan: (currentPlan) => set({ currentPlan }),

  updateCurrentPlan: (content) =>
    set((s) => ({ currentPlan: (s.currentPlan || "") + content })),

  setContextUsage: (contextUsage) => set({ contextUsage }),

  setPendingInput: (pendingInput) => set({ pendingInput }),

  setClarifyQuestions: (clarifyQuestions) => set({ clarifyQuestions }),
}));
