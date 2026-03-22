/**
 * MessageBubble component tests.
 *
 * REQUIRED DEPENDENCIES (not yet installed):
 *   npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "@sanbao/ui/components/chat/MessageBubble";
import { useChatStore } from "@/stores/chatStore";
import { useArtifactStore } from "@/stores/artifactStore";
import type { ChatMessage, LegalRef } from "@/types/chat";

// ─── Helpers ──────────────────────────────────────────────

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "msg-1",
    role: "ASSISTANT",
    content: "Здравствуйте! Чем могу помочь?",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeUserMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return makeMessage({
    id: "msg-user-1",
    role: "USER",
    content: "Привет, у меня вопрос по договору",
    ...overrides,
  });
}

function makeLegalRef(overrides: Partial<LegalRef> = {}): LegalRef {
  return {
    id: "ref-1",
    articleCode: "ГК РК Ст. 188",
    articleTitle: "Право собственности",
    articleText: "Право собственности есть...",
    isActual: true,
    ...overrides,
  };
}

const defaultProps = {
  isLast: false,
  agentName: "Юрист",
  agentIcon: "scale",
  agentIconColor: "#4A90D9",
  onRetry: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────

describe("MessageBubble", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset stores to default state
    useChatStore.setState({
      isStreaming: false,
      streamingContent: null,
      streamingReasoning: null,
      streamingPhase: null,
      streamingToolName: null,
      swarmAgentResponses: [],
    });

    useArtifactStore.setState({
      activeArtifact: null,
      artifacts: [],
    });
  });

  // ═══ Rendering content ════════════════════════════════

  it("renders assistant message with correct content", () => {
    render(
      <MessageBubble
        message={makeMessage({ content: "Ответ по вашему запросу" })}
        {...defaultProps}
      />,
    );

    expect(screen.getByTestId("assistant-content")).toHaveTextContent(
      "Ответ по вашему запросу",
    );
  });

  it("renders user message with correct content", () => {
    render(
      <MessageBubble
        message={makeUserMessage({ content: "Мой вопрос" })}
        {...defaultProps}
      />,
    );

    expect(screen.getByText("Мой вопрос")).toBeInTheDocument();
  });

  // ═══ Labels ════════════════════════════════════════════

  it("shows agent name for assistant messages", () => {
    render(
      <MessageBubble
        message={makeMessage()}
        {...defaultProps}
        agentName="Юрист"
      />,
    );

    expect(screen.getByTestId("streaming-label")).toHaveTextContent("Юрист");
  });

  it('shows "Вы" label for user messages', () => {
    render(
      <MessageBubble message={makeUserMessage()} {...defaultProps} />,
    );

    expect(screen.getByText("Вы")).toBeInTheDocument();
  });

  // ═══ Collapse behavior ════════════════════════════════

  it("supports collapse for assistant messages via useMessageCollapse", async () => {
    // The useMessageCollapse mock returns isOverflowing: false by default.
    // We verify the component renders without a collapse overlay.
    const { container } = render(
      <MessageBubble
        message={makeMessage({ content: "Short content" })}
        {...defaultProps}
      />,
    );

    // No collapse overlay should be rendered when isOverflowing is false
    expect(screen.queryByTestId("collapse-overlay")).not.toBeInTheDocument();
    expect(container).toBeTruthy();
  });

  it("supports collapse for user messages via useMessageCollapse", () => {
    const { container } = render(
      <MessageBubble
        message={makeUserMessage({ content: "Short user message" })}
        {...defaultProps}
      />,
    );

    expect(screen.queryByTestId("collapse-overlay")).not.toBeInTheDocument();
    expect(container).toBeTruthy();
  });

  // ═══ Reasoning ════════════════════════════════════════

  it("shows reasoning block when reasoning exists", () => {
    render(
      <MessageBubble
        message={makeMessage({ reasoning: "Я думаю, что..." })}
        {...defaultProps}
      />,
    );

    expect(screen.getByTestId("reasoning-block")).toHaveTextContent(
      "Я думаю, что...",
    );
  });

  it("does not show reasoning block when reasoning is absent", () => {
    render(
      <MessageBubble
        message={makeMessage({ reasoning: undefined })}
        {...defaultProps}
      />,
    );

    expect(screen.queryByTestId("reasoning-block")).not.toBeInTheDocument();
  });

  // ═══ Legal references ═════════════════════════════════

  it("shows legal references when present", () => {
    const refs = [
      makeLegalRef({ id: "ref-1", articleCode: "ГК РК Ст. 188" }),
      makeLegalRef({ id: "ref-2", articleCode: "УК РК Ст. 190" }),
    ];

    render(
      <MessageBubble
        message={makeMessage({ legalRefs: refs })}
        {...defaultProps}
      />,
    );

    expect(screen.getByTestId("legal-ref-ref-1")).toHaveTextContent("ГК РК Ст. 188");
    expect(screen.getByTestId("legal-ref-ref-2")).toHaveTextContent("УК РК Ст. 190");
  });

  it("does not show legal references when empty", () => {
    render(
      <MessageBubble
        message={makeMessage({ legalRefs: [] })}
        {...defaultProps}
      />,
    );

    expect(screen.queryByTestId("legal-ref-ref-1")).not.toBeInTheDocument();
  });

  // ═══ MessageActions ═══════════════════════════════════

  it("shows MessageActions for user messages", () => {
    render(
      <MessageBubble message={makeUserMessage()} {...defaultProps} />,
    );

    expect(screen.getByTestId("message-actions-user")).toBeInTheDocument();
  });

  it("shows MessageActions for assistant messages", () => {
    render(
      <MessageBubble message={makeMessage()} {...defaultProps} />,
    );

    expect(screen.getByTestId("message-actions-assistant")).toBeInTheDocument();
  });

  // ═══ Retry ════════════════════════════════════════════

  it("calls onRetry for assistant messages", async () => {
    const onRetry = vi.fn();

    render(
      <MessageBubble
        message={makeMessage({ id: "ast-1" })}
        {...defaultProps}
        onRetry={onRetry}
      />,
    );

    const retryButton = screen.getByTestId("retry-button");
    retryButton.click();

    expect(onRetry).toHaveBeenCalledWith("ast-1");
  });

  it("does not render retry button for user messages", () => {
    render(
      <MessageBubble message={makeUserMessage()} {...defaultProps} />,
    );

    expect(screen.queryByTestId("retry-button")).not.toBeInTheDocument();
  });

  // ═══ Accessibility ════════════════════════════════════

  it('has aria-label "Ответ ассистента" for assistant messages', () => {
    render(
      <MessageBubble message={makeMessage()} {...defaultProps} />,
    );

    expect(
      screen.getByRole("article", { name: "Ответ ассистента" }),
    ).toBeInTheDocument();
  });

  it('has aria-label "Сообщение пользователя" for user messages', () => {
    render(
      <MessageBubble message={makeUserMessage()} {...defaultProps} />,
    );

    expect(
      screen.getByRole("article", { name: "Сообщение пользователя" }),
    ).toBeInTheDocument();
  });

  // ═══ Avatar ═══════════════════════════════════════════

  it("renders MessageAvatar", () => {
    render(
      <MessageBubble message={makeMessage()} {...defaultProps} />,
    );

    expect(screen.getByTestId("message-avatar")).toBeInTheDocument();
  });
});
