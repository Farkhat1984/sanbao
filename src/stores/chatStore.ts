/**
 * Backward-compatible facade — re-exports from the 3 focused stores.
 *
 * All existing `import { useChatStore } from "@/stores/chatStore"` continue working.
 * New code should import directly from the focused store it needs:
 *   - useMessagesStore  — conversations, messages, swarm, pagination
 *   - useStreamingStore — streaming state, phases, content buffer
 *   - useAiSettingsStore — provider, thinking, web search, planning toggles
 */

// Re-export types and individual stores for direct access
export { useMessagesStore, type SwarmAgentResponse, type ClarifyQuestion, type ContextUsage } from "./messagesStore";
export { useStreamingStore, type StreamingPhase } from "./streamingStore";
export { useAiSettingsStore } from "./aiSettingsStore";

import { useMessagesStore } from "./messagesStore";
import { useStreamingStore } from "./streamingStore";
import { useAiSettingsStore } from "./aiSettingsStore";
// ---------------------------------------------------------------------------
// Combined store type — union of all 3 stores' states for backward compat
// ---------------------------------------------------------------------------

type MessagesState = ReturnType<typeof useMessagesStore.getState>;
type StreamingState = ReturnType<typeof useStreamingStore.getState>;
type AiSettingsState = ReturnType<typeof useAiSettingsStore.getState>;

type CombinedChatState = MessagesState & StreamingState & AiSettingsState;

// ---------------------------------------------------------------------------
// useChatStore — legacy combined hook
//
// Supports both selector and no-arg usage:
//   const x = useChatStore(s => s.messages)
//   const { messages, isStreaming } = useChatStore()
//   useChatStore.getState().addMessage(...)
//   useChatStore.setState({ ... })
// ---------------------------------------------------------------------------

function getCombinedState(): CombinedChatState {
  return {
    ...useMessagesStore.getState(),
    ...useStreamingStore.getState(),
    ...useAiSettingsStore.getState(),
  };
}

/**
 * Combined hook that subscribes to all 3 stores.
 * When called with a selector, re-renders only when the selected value changes.
 * When called without args, re-renders on any change in any of the 3 stores.
 */
function useChatStoreHook(): CombinedChatState;
function useChatStoreHook<T>(selector: (state: CombinedChatState) => T): T;
function useChatStoreHook<T>(selector?: (state: CombinedChatState) => T): T | CombinedChatState {
  // Subscribe to all 3 stores so React re-renders when any of them changes.
  // Zustand selectors use Object.is by default, so unchanged selectors won't trigger re-renders.
  const messagesState = useMessagesStore();
  const streamingState = useStreamingStore();
  const aiSettingsState = useAiSettingsStore();

  const combined: CombinedChatState = {
    ...messagesState,
    ...streamingState,
    ...aiSettingsState,
  };

  if (selector) {
    return selector(combined);
  }
  return combined;
}

/**
 * setState that dispatches to the correct underlying store.
 */
function setCombinedState(partial: Partial<CombinedChatState> | ((state: CombinedChatState) => Partial<CombinedChatState>)): void {
  const resolved = typeof partial === "function" ? partial(getCombinedState()) : partial;

  // Partition keys into the correct stores
  const messagesKeys = new Set<string>(Object.keys(useMessagesStore.getState()));
  const streamingKeys = new Set<string>(Object.keys(useStreamingStore.getState()));
  const aiSettingsKeys = new Set<string>(Object.keys(useAiSettingsStore.getState()));

  const messagesPatch: Record<string, unknown> = {};
  const streamingPatch: Record<string, unknown> = {};
  const aiSettingsPatch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(resolved)) {
    if (messagesKeys.has(key)) {
      messagesPatch[key] = value;
    }
    if (streamingKeys.has(key)) {
      streamingPatch[key] = value;
    }
    if (aiSettingsKeys.has(key)) {
      aiSettingsPatch[key] = value;
    }
  }

  if (Object.keys(messagesPatch).length > 0) {
    useMessagesStore.setState(messagesPatch as Partial<ReturnType<typeof useMessagesStore.getState>>);
  }
  if (Object.keys(streamingPatch).length > 0) {
    useStreamingStore.setState(streamingPatch as Partial<ReturnType<typeof useStreamingStore.getState>>);
  }
  if (Object.keys(aiSettingsPatch).length > 0) {
    useAiSettingsStore.setState(aiSettingsPatch as Partial<ReturnType<typeof useAiSettingsStore.getState>>);
  }
}

// Attach static methods to match Zustand's store API
useChatStoreHook.getState = getCombinedState;
useChatStoreHook.setState = setCombinedState;

// Subscribe fans out to all 3 stores
useChatStoreHook.subscribe = (listener: (state: CombinedChatState, prevState: CombinedChatState) => void) => {
  let prev = getCombinedState();
  const handler = () => {
    const next = getCombinedState();
    if (next !== prev) {
      listener(next, prev);
      prev = next;
    }
  };
  const unsub1 = useMessagesStore.subscribe(handler);
  const unsub2 = useStreamingStore.subscribe(handler);
  const unsub3 = useAiSettingsStore.subscribe(handler);
  return () => {
    unsub1();
    unsub2();
    unsub3();
  };
};

// Destroy is a no-op for the facade (individual stores manage their own lifecycle)
useChatStoreHook.destroy = () => {
  // no-op
};

export const useChatStore = useChatStoreHook as typeof useChatStoreHook & {
  getState: typeof getCombinedState;
  setState: typeof setCombinedState;
  subscribe: (listener: (state: CombinedChatState, prevState: CombinedChatState) => void) => () => void;
  destroy: () => void;
};
