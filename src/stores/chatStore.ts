import { create } from "zustand";
import type { ChatMessage, ConversationSummary, AIProvider } from "@/types/chat";

type StreamingPhase = "planning" | "thinking" | "answering" | null;

interface ContextUsage {
  usagePercent: number;
  totalTokens: number;
  contextWindowSize: number;
  isCompacting: boolean;
}

interface ChatState {
  activeConversationId: string | null;
  activeAgentId: string | null;
  conversations: ConversationSummary[];
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingPhase: StreamingPhase;
  isToolWorking: boolean;
  activeToolName: string | null;

  // AI feature toggles
  provider: AIProvider;
  thinkingEnabled: boolean;
  webSearchEnabled: boolean;

  // Planning mode
  currentPlan: string | null;

  // Autocompact
  contextUsage: ContextUsage | null;

  setActiveConversation: (id: string | null) => void;
  setActiveAgentId: (id: string | null) => void;
  setConversations: (conversations: ConversationSummary[]) => void;
  addConversation: (conversation: ConversationSummary) => void;
  removeConversation: (id: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateLastAssistantMessage: (content: string, reasoning?: string) => void;
  setStreaming: (isStreaming: boolean) => void;
  setStreamingPhase: (phase: StreamingPhase) => void;
  setToolWorking: (isToolWorking: boolean, toolName?: string | null) => void;

  setProvider: (provider: AIProvider) => void;
  toggleThinking: () => void;
  toggleWebSearch: () => void;

  // Planning
  setCurrentPlan: (plan: string | null) => void;
  updateCurrentPlan: (content: string) => void;

  // Context
  setContextUsage: (usage: ContextUsage | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeConversationId: null,
  activeAgentId: null,
  conversations: [],
  messages: [],
  isStreaming: false,
  streamingPhase: null,
  isToolWorking: false,
  activeToolName: null,

  provider: "deepinfra",
  thinkingEnabled: true,
  webSearchEnabled: false,

  currentPlan: null,
  contextUsage: null,

  setActiveConversation: (activeConversationId) =>
    set({ activeConversationId }),

  setActiveAgentId: (activeAgentId) => set({ activeAgentId }),

  setConversations: (conversations) => set({ conversations }),

  addConversation: (conversation) =>
    set((s) => ({ conversations: [conversation, ...s.conversations] })),

  removeConversation: (id) =>
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeConversationId:
        s.activeConversationId === id ? null : s.activeConversationId,
    })),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message] })),

  updateLastAssistantMessage: (content, reasoning) =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "ASSISTANT") {
          msgs[i] = {
            ...msgs[i],
            content,
            ...(reasoning !== undefined ? { reasoning } : {}),
          };
          break;
        }
      }
      return { messages: msgs };
    }),

  setStreaming: (isStreaming) =>
    set({ isStreaming, ...(isStreaming ? {} : { streamingPhase: null, currentPlan: null }) }),

  setStreamingPhase: (streamingPhase) => set({ streamingPhase }),

  setToolWorking: (isToolWorking, toolName = null) =>
    set({ isToolWorking, activeToolName: toolName }),

  setProvider: (provider) => set({ provider }),
  toggleThinking: () => set((s) => ({ thinkingEnabled: !s.thinkingEnabled })),
  toggleWebSearch: () => set((s) => ({ webSearchEnabled: !s.webSearchEnabled })),

  setCurrentPlan: (currentPlan) => set({ currentPlan }),

  updateCurrentPlan: (content) =>
    set((s) => ({ currentPlan: (s.currentPlan || "") + content })),

  setContextUsage: (contextUsage) => set({ contextUsage }),
}));
