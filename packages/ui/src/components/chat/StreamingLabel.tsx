"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "@/hooks/useTranslation";
import type { ToolCategory } from "@/lib/chat/tool-categories";

// ─── Types ────────────────────────────────────────────────

export type StreamingPhase =
  | "thinking"
  | "searching"
  | "using_tool"
  | "planning"
  | "answering"
  | "routing"
  | "consulting"
  | "synthesizing"
  | null;

interface StreamingLabelProps {
  agentName?: string;
  streamingPhase: StreamingPhase;
  streamingCategory: ToolCategory | null;
  isCurrentlyStreaming: boolean;
}

// ─── Constants ────────────────────────────────────────────

/** Maps tool category to streaming translation key */
const TOOL_LABEL_KEYS: Record<string, string> = {
  web_search: "streaming.webSearch",
  knowledge: "streaming.knowledge",
  calculation: "streaming.calculating",
  memory: "streaming.saving",
  task: "streaming.creatingTask",
  chart: "streaming.buildingChart",
  mcp: "streaming.plugin",
  generic: "streaming.searchingGeneric",
};

/** Maps multi-agent phase to streaming translation key */
const PHASE_LABEL_KEYS: Record<string, string> = {
  routing: "streaming.routing",
  consulting: "streaming.consulting",
  synthesizing: "streaming.synthesizing",
  planning: "streaming.planning",
};

// ─── Helpers ──────────────────────────────────────────────

const DOT_INDICES = [0, 1, 2] as const;

function resolveLabelKey(
  streamingPhase: StreamingPhase,
  streamingCategory: ToolCategory | null,
): string | null {
  if (!streamingPhase) return null;

  const isToolPhase = streamingPhase === "searching" || streamingPhase === "using_tool";
  if (isToolPhase) {
    return TOOL_LABEL_KEYS[streamingCategory || "generic"] || "streaming.searchingGeneric";
  }

  return PHASE_LABEL_KEYS[streamingPhase] || "streaming.answering";
}

// ─── Component ────────────────────────────────────────────

function AnimatedDots() {
  return (
    <span className="inline-flex ml-0.5 gap-[2px]">
      {DOT_INDICES.map((i) => (
        <motion.span
          key={i}
          className="inline-block w-[3px] h-[3px] rounded-full bg-accent"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

/**
 * Displays the agent name with an animated streaming status label.
 * Renders just the agent name when not streaming.
 */
export const StreamingLabel = memo(function StreamingLabel({
  agentName,
  streamingPhase,
  streamingCategory,
  isCurrentlyStreaming,
}: StreamingLabelProps) {
  const { t } = useTranslation();
  const labelKey = isCurrentlyStreaming ? resolveLabelKey(streamingPhase, streamingCategory) : null;
  const name = agentName || t("chat.assistant");

  if (!labelKey) {
    return <>{name}</>;
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span>{name}</span>
      <span className="text-accent">
        · {t(labelKey)}
        <AnimatedDots />
      </span>
    </span>
  );
});
