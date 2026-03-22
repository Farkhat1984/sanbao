/**
 * MessageInput component tests.
 *
 * REQUIRED DEPENDENCIES (not yet installed):
 *   npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageInput } from "@sanbao/ui/components/chat/MessageInput";
import { useStreamingStore } from "@/stores/streamingStore";
import { useAiSettingsStore } from "@/stores/aiSettingsStore";
import { useAgentStore } from "@/stores/agentStore";

// ─── Local mocks for useStreamChat ────────────────────────
// These must match the mocks declared in setup-ui.tsx.
// We re-declare them here to have direct access in assertions.

const doSubmitMock = vi.fn();
const handleStopMock = vi.fn();

vi.mock("@/hooks/useStreamChat", () => ({
  useStreamChat: vi.fn(() => ({
    doSubmit: doSubmitMock,
    handleStop: handleStopMock,
  })),
}));

vi.mock("@sanbao/ui/hooks/useStreamChat", () => ({
  useStreamChat: vi.fn(() => ({
    doSubmit: doSubmitMock,
    handleStop: handleStopMock,
  })),
}));

// ─── Store resets ─────────────────────────────────────────

function resetStores() {
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
}

// ─── Tests ────────────────────────────────────────────────

describe("MessageInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  // ═══ Rendering ════════════════════════════════════════

  it("renders textarea with correct placeholder", () => {
    render(<MessageInput />);

    const textarea = screen.getByRole("textbox", { name: "Введите сообщение" });
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute("placeholder", "Напишите сообщение...");
  });

  it("renders textarea element", () => {
    render(<MessageInput />);

    const textarea = screen.getByRole("textbox");
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  // ═══ Text input handling ══════════════════════════════

  it("handles text input", async () => {
    const user = userEvent.setup();
    render(<MessageInput />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Привет");

    expect(textarea).toHaveValue("Привет");
  });

  // ═══ Submit behavior ══════════════════════════════════

  it("submits on Enter (not Shift+Enter)", () => {
    render(<MessageInput />);

    const textarea = screen.getByRole("textbox");

    // Type some text first
    fireEvent.change(textarea, { target: { value: "Тестовое сообщение" } });

    // Press Enter
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(doSubmitMock).toHaveBeenCalled();
  });

  it("does not submit on Shift+Enter (adds newline)", () => {
    render(<MessageInput />);

    const textarea = screen.getByRole("textbox");

    fireEvent.change(textarea, { target: { value: "Первая строка" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    // Shift+Enter should NOT trigger submit
    expect(doSubmitMock).not.toHaveBeenCalled();
  });

  // ═══ Send button state ════════════════════════════════

  it("shows disabled send button when input is empty", () => {
    render(<MessageInput />);

    // When empty and no speech support, the send-disabled button is rendered
    const buttons = screen.getAllByRole("button");
    const disabledButton = buttons.find((btn) => (btn as HTMLButtonElement).disabled);
    expect(disabledButton).toBeDefined();
  });

  // ═══ Streaming state ══════════════════════════════════

  it("shows stop button during streaming", () => {
    useStreamingStore.setState({ isStreaming: true });

    render(<MessageInput />);

    expect(
      screen.getByRole("button", { name: "Остановить генерацию" }),
    ).toBeInTheDocument();
  });

  it("calls handleStop when stop button is clicked during streaming", async () => {
    useStreamingStore.setState({ isStreaming: true });
    const user = userEvent.setup();

    render(<MessageInput />);

    const stopButton = screen.getByRole("button", { name: "Остановить генерацию" });
    await user.click(stopButton);

    expect(handleStopMock).toHaveBeenCalled();
  });

  // ═══ Thinking toggle ══════════════════════════════════

  it("shows thinking badge when thinkingEnabled", () => {
    useAiSettingsStore.setState({ thinkingEnabled: true });

    render(<MessageInput />);

    expect(screen.getByText("Thinking")).toBeInTheDocument();
  });

  it("does not show thinking badge when thinkingEnabled is false", () => {
    useAiSettingsStore.setState({ thinkingEnabled: false });

    render(<MessageInput />);

    expect(screen.queryByText("Thinking")).not.toBeInTheDocument();
  });

  it("toggles thinking off when thinking badge is clicked", async () => {
    useAiSettingsStore.setState({ thinkingEnabled: true });
    const user = userEvent.setup();

    render(<MessageInput />);

    const thinkingBadge = screen.getByText("Thinking").closest("button");
    expect(thinkingBadge).toBeTruthy();
    await user.click(thinkingBadge!);

    // After toggling, thinkingEnabled should be false
    expect(useAiSettingsStore.getState().thinkingEnabled).toBe(false);
  });

  // ═══ Hint text ════════════════════════════════════════

  it("shows keyboard shortcut hint on desktop", () => {
    render(<MessageInput />);

    expect(
      screen.getByText("Enter — отправить, Shift+Enter — новая строка"),
    ).toBeInTheDocument();
  });

  it("shows Sanbao AI branding", () => {
    render(<MessageInput />);

    expect(screen.getByText("Sanbao AI")).toBeInTheDocument();
  });

  // ═══ Plus menu ════════════════════════════════════════

  it("renders PlusMenu", () => {
    render(<MessageInput />);

    expect(screen.getByTestId("plus-menu")).toBeInTheDocument();
  });
});
