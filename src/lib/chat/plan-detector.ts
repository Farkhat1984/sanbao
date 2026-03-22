/**
 * Plan detection utilities for NDJSON streaming.
 *
 * Wraps the low-level plan-parser state machine with NDJSON encoding helpers
 * shared by both ai-sdk-stream and moonshot-stream. Eliminates the duplicated
 * encode-and-enqueue loops that appear in every streaming handler.
 */

import {
  createPlanDetectorState,
  feedPlanDetector,
  flushPlanDetector,
  type PlanDetectorState,
  type PlanDetectorFlush,
} from "@/lib/chat/plan-parser";

// Re-export for consumers that only need the high-level API
export {
  createPlanDetectorState,
  feedPlanDetector,
  flushPlanDetector,
  type PlanDetectorState,
  type PlanDetectorFlush,
};

// ─── Shared TextEncoder (singleton) ─────────────────────

const sharedEncoder = new TextEncoder();

// ─── NDJSON encoding helpers ────────────────────────────

/** Encode a single NDJSON chunk: `{ t, v }` + newline → Uint8Array */
export function encodeNdjsonChunk(type: string, value: string): Uint8Array {
  return sharedEncoder.encode(JSON.stringify({ t: type, v: value }) + "\n");
}

/** Encode an NDJSON chunk with an extra field: `{ t, v, n }` + newline */
export function encodeNdjsonChunkWithName(
  type: string,
  value: string,
  name: string,
): Uint8Array {
  return sharedEncoder.encode(
    JSON.stringify({ t: type, v: value, n: name }) + "\n",
  );
}

// ─── Context info emission ──────────────────────────────

export interface StreamContextInfo {
  usagePercent: number;
  totalTokens: number;
  contextWindowSize: number;
  compacting: boolean;
}

/**
 * Emit context info as the first NDJSON chunk.
 * Shared by both ai-sdk-stream and moonshot-stream.
 */
export function emitContextInfo(
  controller: ReadableStreamDefaultController,
  contextInfo: StreamContextInfo,
): void {
  controller.enqueue(
    sharedEncoder.encode(
      JSON.stringify({
        t: "x",
        v: JSON.stringify({
          action: "context_info",
          ...contextInfo,
        }),
      }) + "\n",
    ),
  );
}

// ─── Plan detector chunk encoding ───────────────────────

/**
 * Feed text into the plan detector and enqueue all resulting NDJSON chunks.
 * This is the core pattern that was duplicated 5+ times across the two stream files.
 */
export function feedAndEnqueue(
  controller: ReadableStreamDefaultController,
  planState: PlanDetectorState,
  text: string,
): void {
  const { chunks } = feedPlanDetector(planState, text);
  for (const ch of chunks) {
    controller.enqueue(encodeNdjsonChunk(ch.type, ch.text));
  }
}

/**
 * Flush remaining plan detector buffer and enqueue final NDJSON chunks.
 * Call this when the stream ends to ensure no content is lost.
 */
export function flushAndEnqueue(
  controller: ReadableStreamDefaultController,
  planState: PlanDetectorState,
): void {
  const { chunks } = flushPlanDetector(planState);
  for (const ch of chunks) {
    controller.enqueue(encodeNdjsonChunk(ch.type, ch.text));
  }
}

// ─── Buffer overflow safety ─────────────────────────────

/**
 * Check if the plan state buffer would overflow with the next chunk.
 * If so, flush the current buffer as the appropriate type before feeding more.
 *
 * @returns `true` if overflow was handled (caller should still call feedAndEnqueue after)
 */
export function handleBufferOverflow(
  controller: ReadableStreamDefaultController,
  planState: PlanDetectorState,
  incomingLength: number,
  maxBuffer: number,
): boolean {
  if (planState.buffer.length + incomingLength > maxBuffer) {
    const type = planState.insidePlan ? "p" : "c";
    controller.enqueue(encodeNdjsonChunk(type, planState.buffer));
    planState.buffer = "";
    return true;
  }
  return false;
}

// ─── Error emission ─────────────────────────────────────

/** Enqueue a generic error chunk. */
export function emitError(
  controller: ReadableStreamDefaultController,
  message: string,
): void {
  controller.enqueue(encodeNdjsonChunk("e", message));
}
