import { create } from "zustand";
import { PHASE_PRIORITY } from "@/lib/chat/tool-categories";
import { useMessagesStore } from "./messagesStore";

export type StreamingPhase = "thinking" | "searching" | "using_tool" | "planning" | "answering" | "routing" | "consulting" | "synthesizing" | null;

interface StreamingState {
  isStreaming: boolean;
  streamingPhase: StreamingPhase;
  streamingToolName: string | null;

  // Streaming content buffer (merged into messages when stream ends)
  streamingContent: string | null;
  streamingReasoning: string | null;
  streamingPlanContent: string | null;

  setStreaming: (isStreaming: boolean) => void;
  setStreamingPhase: (phase: StreamingPhase, toolName?: string | null) => void;
  updateLastAssistantMessage: (content: string, reasoning?: string, planContent?: string) => void;
  /** Get the latest content for the last assistant message (streaming or committed) */
  getLastAssistantContent: () => { content: string; reasoning?: string; planContent?: string } | null;
}

export const useStreamingStore = create<StreamingState>((set, get) => ({
  isStreaming: false,
  streamingPhase: null,
  streamingToolName: null,
  streamingContent: null,
  streamingReasoning: null,
  streamingPlanContent: null,

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
        // Merge streaming buffer into messagesStore when stream ends
        const messagesState = useMessagesStore.getState();
        const msgs = [...messagesState.messages];
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
        // Update messages in the messagesStore
        useMessagesStore.setState({ messages: msgs });
        return {
          isStreaming: false,
          streamingPhase: null,
          streamingToolName: null,
          streamingContent: null,
          streamingReasoning: null,
          streamingPlanContent: null,
        };
      }
      return { isStreaming, ...(isStreaming ? {} : { streamingPhase: null, streamingToolName: null }) };
    }),

  setStreamingPhase: (phase, toolName) => {
    if (!phase) {
      set({ streamingPhase: null, streamingToolName: null });
      return;
    }
    // searching and using_tool are overlays — always allowed to update
    // (tool type can change between web search and knowledge base within a turn)
    if (phase === "searching" || phase === "using_tool") {
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
}));
