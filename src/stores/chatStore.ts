import { create } from "zustand";
import type { ChatMessage, ConversationSummary } from "@/types/chat";

export type StreamingPhase = "thinking" | "searching" | "using_tool" | "planning" | "answering" | null;

/** Tool categories for granular status icons */
export type ToolCategory = "web_search" | "knowledge" | "calculation" | "memory" | "task" | "notification" | "scratchpad" | "chart" | "http" | "mcp" | "generic";

const TOOL_CATEGORY_MAP: Record<string, ToolCategory> = {
  read_knowledge: "knowledge",
  search_knowledge: "knowledge",
  calculate: "calculation",
  analyze_csv: "calculation",
  generate_chart_data: "chart",
  save_memory: "memory",
  create_task: "task",
  send_notification: "notification",
  write_scratchpad: "scratchpad",
  read_scratchpad: "scratchpad",
  http_request: "http",
  get_current_time: "generic",
  get_user_info: "generic",
  get_conversation_context: "generic",
};

export function getToolCategory(toolName: string | null): ToolCategory {
  if (!toolName) return "generic";
  return TOOL_CATEGORY_MAP[toolName] || "mcp";
}

const PHASE_PRIORITY: Record<string, number> = {
  thinking: 1,
  searching: 2,
  using_tool: 2,
  planning: 3,
  answering: 4,
};

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

interface ChatState {
  activeConversationId: string | null;
  activeAgentId: string | null;
  conversations: ConversationSummary[];
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingPhase: StreamingPhase;
  streamingToolName: string | null;

  // AI feature toggles
  provider: string;
  thinkingEnabled: boolean;
  webSearchEnabled: boolean;
  planningEnabled: boolean;

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
  updateLastAssistantMessage: (content: string, reasoning?: string, planContent?: string) => void;
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

export const useChatStore = create<ChatState>((set) => ({
  activeConversationId: null,
  activeAgentId: null,
  conversations: [],
  messages: [],
  isStreaming: false,
  streamingPhase: null,
  streamingToolName: null,
  provider: "default",
  thinkingEnabled: false,
  webSearchEnabled: false,
  planningEnabled: false,

  currentPlan: null,
  contextUsage: null,
  pendingInput: null,
  clarifyQuestions: null,

  setActiveConversation: (activeConversationId) =>
    set(activeConversationId === null
      ? { activeConversationId, messages: [], currentPlan: null, contextUsage: null }
      : { activeConversationId }),

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

  updateLastAssistantMessage: (content, reasoning, planContent) =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "ASSISTANT") {
          msgs[i] = {
            ...msgs[i],
            content,
            ...(reasoning !== undefined ? { reasoning } : {}),
            ...(planContent !== undefined ? { planContent } : {}),
          };
          break;
        }
      }
      return { messages: msgs };
    }),

  setStreaming: (isStreaming) =>
    set({ isStreaming, ...(isStreaming ? {} : { streamingPhase: null, streamingToolName: null }) }),

  setStreamingPhase: (phase, toolName) => set((s) => {
    if (!phase) return { streamingPhase: null, streamingToolName: null };
    // searching is an overlay — always allowed
    if (phase === "searching") return { streamingPhase: phase, streamingToolName: toolName ?? null };
    const curr = s.streamingPhase ? PHASE_PRIORITY[s.streamingPhase] || 0 : 0;
    const next = PHASE_PRIORITY[phase] || 0;
    return next > curr ? { streamingPhase: phase, streamingToolName: toolName ?? null } : {};
  }),

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
