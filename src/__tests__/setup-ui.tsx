/**
 * UI component test setup.
 *
 * REQUIRED DEPENDENCIES (not yet installed):
 *   npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
 *
 * This setup file extends the base `setup.ts` with browser-environment mocks
 * needed for rendering React components under jsdom.
 */

import { vi } from "vitest";

import "@testing-library/jest-dom/vitest";

// Inline minimal jest-dom matchers until @testing-library/jest-dom is installed.
// This provides toBeInTheDocument, toHaveTextContent, toHaveAttribute, toHaveValue.
import { expect } from "vitest";

function isHTMLElement(el: unknown): el is HTMLElement {
  return el instanceof HTMLElement;
}

expect.extend({
  toBeInTheDocument(received: unknown) {
    const pass = received instanceof HTMLElement && document.documentElement.contains(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected element not to be in the document`
          : `expected element to be in the document`,
    };
  },
  toHaveTextContent(received: unknown, expected: string | RegExp) {
    if (!isHTMLElement(received)) {
      return { pass: false, message: () => "expected an HTMLElement" };
    }
    const text = received.textContent ?? "";
    const pass = typeof expected === "string" ? text.includes(expected) : expected.test(text);
    return {
      pass,
      message: () =>
        pass
          ? `expected element not to have text content "${expected}", but got "${text}"`
          : `expected element to have text content "${expected}", but got "${text}"`,
    };
  },
  toHaveAttribute(received: unknown, attr: string, value?: string) {
    if (!isHTMLElement(received)) {
      return { pass: false, message: () => "expected an HTMLElement" };
    }
    const hasAttr = received.hasAttribute(attr);
    const pass = value !== undefined ? received.getAttribute(attr) === value : hasAttr;
    return {
      pass,
      message: () =>
        pass
          ? `expected element not to have attribute "${attr}"${value !== undefined ? ` with value "${value}"` : ""}`
          : `expected element to have attribute "${attr}"${value !== undefined ? ` with value "${value}", got "${received.getAttribute(attr)}"` : ""}`,
    };
  },
  toHaveValue(received: unknown, expected: string) {
    const el = received as HTMLInputElement | HTMLTextAreaElement;
    const pass = el?.value === expected;
    return {
      pass,
      message: () =>
        pass
          ? `expected element not to have value "${expected}"`
          : `expected element to have value "${expected}", got "${el?.value}"`,
    };
  },
});

// ─── Mock next/navigation ─────────────────────────────────
const pushMock = vi.fn();
const replaceMock = vi.fn();
const backMock = vi.fn();
const prefetchMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    back: backMock,
    prefetch: prefetchMock,
    refresh: refreshMock,
    pathname: "/",
    query: {},
    asPath: "/",
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Navigation mocks available via vi.mocked imports if needed.

// ─── Mock next/image ──────────────────────────────────────
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text, @typescript-eslint/no-explicit-any
    const { fill, priority, ...rest } = props as any;
    return <img {...rest} />;
  },
}));

// ─── Mock framer-motion ───────────────────────────────────
// Replace motion components with plain HTML elements and stub hooks.
vi.mock("framer-motion", () => {
  const React = require("react");

  function createMotionProxy() {
    return new Proxy(
      {},
      {
        get(_target: unknown, prop: string) {
          // motion.div, motion.button, motion.span, etc.
          return React.forwardRef(function MotionComponent(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            props: any,
            ref: React.Ref<HTMLElement>,
          ) {
            const {
              initial: _initial,
              animate: _animate,
              exit: _exit,
              transition: _transition,
              variants: _variants,
              whileHover: _whileHover,
              whileTap: _whileTap,
              whileFocus: _whileFocus,
              whileInView: _whileInView,
              layout: _layout,
              layoutId: _layoutId,
              onAnimationComplete: _onAnimationComplete,
              ...rest
            } = props;
            return React.createElement(prop, { ...rest, ref });
          });
        },
      },
    );
  }

  return {
    motion: createMotionProxy(),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useMotionValue: (initial: number) => ({
      get: () => initial,
      set: vi.fn(),
      onChange: vi.fn(),
    }),
    useTransform: (value: unknown, _inputRange: number[], outputRange: number[]) => ({
      get: () => outputRange[0],
      set: vi.fn(),
      onChange: vi.fn(),
    }),
    useSpring: (value: unknown) => value,
    useAnimation: () => ({
      start: vi.fn(),
      stop: vi.fn(),
      set: vi.fn(),
    }),
    useInView: () => true,
    useScroll: () => ({
      scrollX: { get: () => 0, onChange: vi.fn() },
      scrollY: { get: () => 0, onChange: vi.fn() },
      scrollXProgress: { get: () => 0, onChange: vi.fn() },
      scrollYProgress: { get: () => 0, onChange: vi.fn() },
    }),
  };
});

// ─── Mock useIsMobile ─────────────────────────────────────
// Default to desktop. Individual tests can override via vi.mocked().
vi.mock("@/hooks/useIsMobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

// Re-export for convenience in tests that need the packages/ui path
vi.mock("@sanbao/ui/hooks/useIsMobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

// ─── Mock panel-actions ───────────────────────────────────
vi.mock("@/lib/panel-actions", () => ({
  openArtifactInPanel: vi.fn(),
}));

// ─── Mock parse-message-content ───────────────────────────
// Pass-through — returns content as a single text part
vi.mock("@/lib/parse-message-content", () => ({
  parseContentWithArtifacts: vi.fn((content: string) => [
    { type: "text" as const, content },
  ]),
}));

// ─── Mock chat tool-categories ────────────────────────────
vi.mock("@/lib/chat/tool-categories", () => ({
  getToolCategory: vi.fn(() => null),
  PHASE_PRIORITY: {},
}));

// ─── Mock useAutoApplyEdits ───────────────────────────────
vi.mock("@/hooks/useAutoApplyEdits", () => ({
  useAutoApplyEdits: vi.fn(),
}));

// ─── Mock useMessageCollapse ──────────────────────────────
vi.mock("@/hooks/useMessageCollapse", () => ({
  useMessageCollapse: vi.fn(() => ({
    ref: { current: null },
    isExpanded: false,
    setIsExpanded: vi.fn(),
    isOverflowing: false,
  })),
}));

vi.mock("@sanbao/ui/hooks/useMessageCollapse", () => ({
  useMessageCollapse: vi.fn(() => ({
    ref: { current: null },
    isExpanded: false,
    setIsExpanded: vi.fn(),
    isOverflowing: false,
  })),
}));

// ─── Mock useStreamChat ───────────────────────────────────
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

// ─── Mock useFileAttachment ───────────────────────────────
vi.mock("@/hooks/useFileAttachment", () => ({
  useFileAttachment: vi.fn(() => ({
    files: [],
    addFiles: vi.fn(),
    removeFile: vi.fn(),
    clearFiles: vi.fn(),
    fileInputRef: { current: null },
    cameraInputRef: { current: null },
    alertMessage: null,
    setAlertMessage: vi.fn(),
    acceptedExtensions: ".pdf,.doc,.docx,.txt",
  })),
}));

vi.mock("@sanbao/ui/hooks/useFileAttachment", () => ({
  useFileAttachment: vi.fn(() => ({
    files: [],
    addFiles: vi.fn(),
    removeFile: vi.fn(),
    clearFiles: vi.fn(),
    fileInputRef: { current: null },
    cameraInputRef: { current: null },
    alertMessage: null,
    setAlertMessage: vi.fn(),
    acceptedExtensions: ".pdf,.doc,.docx,.txt",
  })),
}));

// ─── Mock useVoiceRecording ───────────────────────────────
vi.mock("@/hooks/useVoiceRecording", () => ({
  useVoiceRecording: vi.fn(() => ({
    isRecording: false,
    hasSpeechSupport: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
  })),
}));

vi.mock("@sanbao/ui/hooks/useVoiceRecording", () => ({
  useVoiceRecording: vi.fn(() => ({
    isRecording: false,
    hasSpeechSupport: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
  })),
}));

// ─── Mock sub-components used by MessageBubble ────────────
vi.mock("@sanbao/ui/components/chat/LegalReference", () => ({
  LegalReference: ({ reference }: { reference: { id: string; articleCode: string } }) => (
    <div data-testid={`legal-ref-${reference.id}`}>{reference.articleCode}</div>
  ),
}));

vi.mock("@sanbao/ui/components/chat/PlanBlock", () => ({
  PlanBlock: ({ content }: { content: string }) => (
    <div data-testid="plan-block">{content}</div>
  ),
}));

vi.mock("@sanbao/ui/components/chat/MessageAvatar", () => ({
  MessageAvatar: () => <div data-testid="message-avatar" />,
}));

vi.mock("@sanbao/ui/components/chat/ReasoningBlock", () => ({
  ReasoningBlock: ({ reasoning }: { reasoning: string }) => (
    <div data-testid="reasoning-block">{reasoning}</div>
  ),
}));

vi.mock("@sanbao/ui/components/chat/MessageActions", () => ({
  MessageActions: ({ isUser, onRetry, messageId }: { isUser: boolean; onRetry?: (id: string) => void; messageId: string }) => (
    <div data-testid={`message-actions-${isUser ? "user" : "assistant"}`}>
      {onRetry && <button data-testid="retry-button" onClick={() => onRetry(messageId)}>Retry</button>}
    </div>
  ),
}));

vi.mock("@sanbao/ui/components/chat/CollapseOverlay", () => ({
  CollapseOverlay: ({ onToggle, isExpanded }: { onToggle: () => void; isExpanded: boolean }) => (
    <button data-testid="collapse-overlay" onClick={onToggle}>
      {isExpanded ? "Collapse" : "Expand"}
    </button>
  ),
}));

vi.mock("@sanbao/ui/components/chat/SwarmResponses", () => ({
  SwarmResponses: () => null,
}));

vi.mock("@sanbao/ui/components/chat/AssistantContent", () => ({
  AssistantContent: ({ displayContent }: { displayContent: string }) => (
    <div data-testid="assistant-content">{displayContent}</div>
  ),
}));

vi.mock("@sanbao/ui/components/chat/StreamingLabel", () => ({
  StreamingLabel: ({ agentName }: { agentName?: string }) => (
    <span data-testid="streaming-label">{agentName ?? "Ассистент"}</span>
  ),
}));

// ─── Mock ChatArea sub-components (lazy loaded) ───────────
vi.mock("@/components/tasks/TaskPanel", () => ({
  TaskPanel: () => <div data-testid="task-panel" />,
}));

vi.mock("@sanbao/ui/components/chat/ClarifyModal", () => ({
  ClarifyModal: () => null,
}));

vi.mock("@sanbao/ui/components/chat/WelcomeScreen", () => ({
  WelcomeScreen: () => <div data-testid="welcome-screen">Welcome</div>,
}));

vi.mock("@sanbao/ui/components/chat/ContextIndicator", () => ({
  ContextIndicator: ({ usagePercent }: { usagePercent: number }) => (
    <div data-testid="context-indicator">{usagePercent}%</div>
  ),
}));

vi.mock("@sanbao/ui/components/chat/PlusMenu", () => ({
  PlusMenu: () => <div data-testid="plus-menu" />,
}));

vi.mock("@/components/chat/PlusMenu", () => ({
  PlusMenu: () => <div data-testid="plus-menu" />,
}));

vi.mock("@/components/ui/AlertModal", () => ({
  AlertModal: () => null,
}));

// ─── Global fetch mock ────────────────────────────────────
// Prevent real HTTP requests in component tests
if (!globalThis.fetch || !(globalThis.fetch as ReturnType<typeof vi.fn> & { _isMockFunction?: boolean })._isMockFunction) {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({}), { status: 200 }),
  );
}

// ─── matchMedia polyfill for jsdom ────────────────────────
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// ─── IntersectionObserver polyfill ────────────────────────
if (typeof window !== "undefined" && !window.IntersectionObserver) {
  class MockIntersectionObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    value: MockIntersectionObserver,
  });
}

// ─── ResizeObserver polyfill ──────────────────────────────
if (typeof window !== "undefined" && !window.ResizeObserver) {
  class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: MockResizeObserver,
  });
}

// ─── scrollIntoView polyfill ──────────────────────────────
if (typeof window !== "undefined") {
  Element.prototype.scrollIntoView = vi.fn();
}
