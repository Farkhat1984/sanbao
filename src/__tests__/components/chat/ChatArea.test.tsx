/**
 * ChatArea component tests.
 *
 * REQUIRED DEPENDENCIES (not yet installed):
 *   npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import { ChatArea } from "@sanbao/ui/components/chat/ChatArea";
import { useMessagesStore } from "@/stores/messagesStore";
import { useStreamingStore } from "@/stores/streamingStore";
import { useAiSettingsStore } from "@/stores/aiSettingsStore";
import { useAgentStore } from "@/stores/agentStore";
import { useTaskStore } from "@/stores/taskStore";
import type { ChatMessage, ConversationSummary } from "@/types/chat";

// ─── Helpers ──────────────────────────────────────────────

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    role: "ASSISTANT",
    content: "Ответ ассистента",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeConversation(overrides: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id: "conv-1",
    title: "Тестовая беседа",
    pinned: false,
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    agentName: "Юрист",
    agentIcon: "scale",
    agentIconColor: "#4A90D9",
    ...overrides,
  };
}

/**
 * Reset all stores to clean defaults before each test.
 */
function resetStores() {
  useMessagesStore.setState({
    messages: [],
    conversations: [],
    activeConversationId: null,
    activeAgentId: null,
    orgAgentId: null,
    swarmMode: false,
    swarmOrgId: null,
    multiAgentId: null,
    swarmAgentResponses: [],
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
  });

  useStreamingStore.setState({
    isStreaming: false,
    streamingPhase: null,
    streamingToolName: null,
    streamingContent: null,
    streamingReasoning: null,
    streamingPlanContent: null,
  });

  useAiSettingsStore.setState({
    provider: "default",
    thinkingEnabled: false,
    webSearchEnabled: false,
    planningEnabled: false,
  });

  useAgentStore.setState({
    agents: [],
    activeAgent: null,
    agentTools: [],
    isLoading: false,
  });

  useTaskStore.setState({
    tasks: [],
    isTaskPanelOpen: false,
    isLoading: false,
  });
}

// ─── Mock MessageBubble to avoid deep rendering ──────────
vi.mock("@sanbao/ui/components/chat/MessageBubble", () => ({
  MessageBubble: ({ message }: { message: ChatMessage }) => (
    <div data-testid={`message-bubble-${message.id}`} data-role={message.role}>
      {message.content}
    </div>
  ),
}));

// ─── Mock MessageInput ───────────────────────────────────
vi.mock("@sanbao/ui/components/chat/MessageInput", () => ({
  MessageInput: () => <div data-testid="message-input" />,
}));

// ─── Tests ────────────────────────────────────────────────

describe("ChatArea", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  // ═══ Welcome screen ═══════════════════════════════════

  it("shows WelcomeScreen when no messages and no active conversation", async () => {
    render(<ChatArea />);

    // Wait for lazy component
    const welcome = await screen.findByTestId("welcome-screen");
    expect(welcome).toBeInTheDocument();
  });

  it("shows WelcomeScreen when active conversation has no messages", async () => {
    useMessagesStore.setState({
      activeConversationId: "conv-1",
      conversations: [makeConversation()],
      messages: [],
      isLoadingConversation: false,
    });

    render(<ChatArea />);

    const welcome = await screen.findByTestId("welcome-screen");
    expect(welcome).toBeInTheDocument();
  });

  // ═══ Loading skeleton ═════════════════════════════════

  it("shows loading skeleton when isLoadingConversation is true", () => {
    useMessagesStore.setState({
      activeConversationId: "conv-1",
      isLoadingConversation: true,
      messages: [],
    });

    const { container } = render(<ChatArea />);

    // The loading skeleton renders 4 pulse rows
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("does not show WelcomeScreen when loading", () => {
    useMessagesStore.setState({
      activeConversationId: "conv-1",
      isLoadingConversation: true,
      messages: [],
    });

    render(<ChatArea />);

    expect(screen.queryByTestId("welcome-screen")).not.toBeInTheDocument();
  });

  // ═══ Message list ═════════════════════════════════════

  it("shows message list when messages exist", () => {
    const messages = [
      makeMessage({ id: "msg-1", role: "USER", content: "Привет" }),
      makeMessage({ id: "msg-2", role: "ASSISTANT", content: "Здравствуйте!" }),
    ];

    useMessagesStore.setState({
      activeConversationId: "conv-1",
      conversations: [makeConversation()],
      messages,
      isLoadingConversation: false,
    });

    render(<ChatArea />);

    expect(screen.getByTestId("message-bubble-msg-1")).toBeInTheDocument();
    expect(screen.getByTestId("message-bubble-msg-2")).toBeInTheDocument();
  });

  it("renders correct number of MessageBubble components", () => {
    const messages = [
      makeMessage({ id: "msg-1", role: "USER", content: "Вопрос 1" }),
      makeMessage({ id: "msg-2", role: "ASSISTANT", content: "Ответ 1" }),
      makeMessage({ id: "msg-3", role: "USER", content: "Вопрос 2" }),
    ];

    useMessagesStore.setState({
      activeConversationId: "conv-1",
      conversations: [makeConversation()],
      messages,
      isLoadingConversation: false,
    });

    render(<ChatArea />);

    expect(screen.getByTestId("message-bubble-msg-1")).toBeInTheDocument();
    expect(screen.getByTestId("message-bubble-msg-2")).toBeInTheDocument();
    expect(screen.getByTestId("message-bubble-msg-3")).toBeInTheDocument();
    expect(screen.queryByTestId("message-bubble-msg-4")).not.toBeInTheDocument();
  });

  // ═══ Auto-scroll ══════════════════════════════════════

  it("auto-scrolls to bottom on new messages", () => {
    const messages = [
      makeMessage({ id: "msg-1", role: "USER", content: "Привет" }),
    ];

    useMessagesStore.setState({
      activeConversationId: "conv-1",
      conversations: [makeConversation()],
      messages,
      isLoadingConversation: false,
    });

    render(<ChatArea />);

    // scrollIntoView is called on the bottom ref after messages change
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  // ═══ Task panel ═══════════════════════════════════════

  it("shows task indicator when active tasks exist", () => {
    useTaskStore.setState({
      tasks: [
        {
          id: "task-1",
          title: "Подготовить договор",
          status: "IN_PROGRESS",
          steps: [],
          progress: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          conversationId: "conv-1",
        },
      ],
    });

    useMessagesStore.setState({
      activeConversationId: "conv-1",
      conversations: [makeConversation()],
      messages: [makeMessage()],
      isLoadingConversation: false,
    });

    render(<ChatArea />);

    expect(screen.getByText(/задач/i)).toBeInTheDocument();
  });

  it("does not show task indicator when no active tasks", () => {
    useTaskStore.setState({ tasks: [] });

    useMessagesStore.setState({
      activeConversationId: "conv-1",
      conversations: [makeConversation()],
      messages: [makeMessage()],
      isLoadingConversation: false,
    });

    render(<ChatArea />);

    expect(screen.queryByText(/задач/i)).not.toBeInTheDocument();
  });

  // ═══ Context indicator ════════════════════════════════

  it("shows context indicator when contextUsage exists", async () => {
    useMessagesStore.setState({
      activeConversationId: "conv-1",
      conversations: [makeConversation()],
      messages: [makeMessage()],
      contextUsage: {
        usagePercent: 75,
        totalTokens: 150000,
        contextWindowSize: 200000,
        isCompacting: false,
      },
      isLoadingConversation: false,
    });

    render(<ChatArea />);

    const indicator = await screen.findByTestId("context-indicator");
    expect(indicator).toHaveTextContent("75%");
  });

  it("does not show context indicator when contextUsage is null", () => {
    useMessagesStore.setState({
      activeConversationId: "conv-1",
      conversations: [makeConversation()],
      messages: [makeMessage()],
      contextUsage: null,
      isLoadingConversation: false,
    });

    render(<ChatArea />);

    expect(screen.queryByTestId("context-indicator")).not.toBeInTheDocument();
  });

  // ═══ Accessibility ════════════════════════════════════

  it("renders messages container with proper aria attributes", () => {
    useMessagesStore.setState({
      activeConversationId: "conv-1",
      conversations: [makeConversation()],
      messages: [makeMessage()],
      isLoadingConversation: false,
    });

    render(<ChatArea />);

    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(log).toHaveAttribute("aria-label", "Сообщения чата");
  });

  // ═══ Load older messages ══════════════════════════════

  it("shows load-older button when hasMoreMessages is true", () => {
    useMessagesStore.setState({
      activeConversationId: "conv-1",
      conversations: [makeConversation()],
      messages: [makeMessage()],
      hasMoreMessages: true,
      messagesCursor: "cursor-123",
      isLoadingConversation: false,
    });

    render(<ChatArea />);

    expect(
      screen.getByText("Загрузить ранние сообщения"),
    ).toBeInTheDocument();
  });

  it("does not show load-older button when hasMoreMessages is false", () => {
    useMessagesStore.setState({
      activeConversationId: "conv-1",
      conversations: [makeConversation()],
      messages: [makeMessage()],
      hasMoreMessages: false,
      isLoadingConversation: false,
    });

    render(<ChatArea />);

    expect(
      screen.queryByText("Загрузить ранние сообщения"),
    ).not.toBeInTheDocument();
  });

  // ═══ MessageInput always rendered ═════════════════════

  it("always renders MessageInput", () => {
    render(<ChatArea />);

    expect(screen.getByTestId("message-input")).toBeInTheDocument();
  });
});
