/**
 * Plan tag detection for streaming responses.
 *
 * Handles `<sanbao-plan>...</sanbao-plan>` tags that arrive across
 * multiple SSE chunks with partial-tag buffering for safe flushing.
 */

const OPEN_TAG = "<sanbao-plan>";
const CLOSE_TAG = "</sanbao-plan>";

export interface PlanDetectorState {
  insidePlan: boolean;
  buffer: string;
}

export interface PlanDetectorFlush {
  /** Chunks to emit: `{ type: "c" | "p", text: string }` */
  chunks: { type: "c" | "p"; text: string }[];
}

/** Create a fresh plan detector state. */
export function createPlanDetectorState(): PlanDetectorState {
  return { insidePlan: false, buffer: "" };
}

/**
 * Feed a text chunk into the plan detector and get back chunks to emit.
 *
 * This handles:
 * - Detecting the opening `<sanbao-plan>` tag (splitting content before it)
 * - Detecting the closing `</sanbao-plan>` tag (splitting content after it)
 * - Incremental flushing of plan content when buffer exceeds 20 chars
 * - Partial tag buffering to avoid splitting a tag across chunks
 */
export function feedPlanDetector(
  state: PlanDetectorState,
  chunk: string,
): PlanDetectorFlush {
  const chunks: { type: "c" | "p"; text: string }[] = [];
  state.buffer += chunk;

  // Check for plan opening tag
  if (!state.insidePlan && state.buffer.includes(OPEN_TAG)) {
    const idx = state.buffer.indexOf(OPEN_TAG);
    const before = state.buffer.slice(0, idx);
    if (before) {
      chunks.push({ type: "c", text: before });
    }
    state.buffer = state.buffer.slice(idx + OPEN_TAG.length);
    state.insidePlan = true;
  }

  if (state.insidePlan) {
    // Check for plan closing tag
    if (state.buffer.includes(CLOSE_TAG)) {
      const idx = state.buffer.indexOf(CLOSE_TAG);
      const planText = state.buffer.slice(0, idx);
      if (planText) {
        chunks.push({ type: "p", text: planText });
      }
      state.buffer = state.buffer.slice(idx + CLOSE_TAG.length);
      state.insidePlan = false;
      // Flush remaining as content
      if (state.buffer) {
        chunks.push({ type: "c", text: state.buffer });
        state.buffer = "";
      }
    } else if (state.buffer.length > 20) {
      // Flush accumulated plan content incrementally
      chunks.push({ type: "p", text: state.buffer });
      state.buffer = "";
    }
  } else {
    // Keep tail that could be a partial "<sanbao-plan>" tag
    let safeFlush = state.buffer;
    let keepTail = "";
    for (let k = 1; k < OPEN_TAG.length; k++) {
      if (state.buffer.endsWith(OPEN_TAG.slice(0, k))) {
        safeFlush = state.buffer.slice(0, -k);
        keepTail = state.buffer.slice(-k);
        break;
      }
    }
    if (safeFlush) {
      chunks.push({ type: "c", text: safeFlush });
    }
    state.buffer = keepTail;
  }

  return { chunks };
}

/**
 * Flush any remaining buffered content at the end of the stream.
 * Returns the final chunk (if any) with the appropriate type.
 */
export function flushPlanDetector(
  state: PlanDetectorState,
): PlanDetectorFlush {
  const chunks: { type: "c" | "p"; text: string }[] = [];
  if (state.buffer) {
    chunks.push({ type: state.insidePlan ? "p" : "c", text: state.buffer });
    state.buffer = "";
  }
  return { chunks };
}
