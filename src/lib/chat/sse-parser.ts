// ─── SSE stream parser for OpenAI-compatible APIs ─────────
// Parses Server-Sent Events from a ReadableStream, yielding
// parsed JSON objects for each `data: {...}` line.

/**
 * Async generator that parses an SSE stream into JSON objects.
 *
 * Handles buffering of partial lines, skips `data: [DONE]` and
 * malformed JSON, and throws on buffer overflow.
 *
 * @param body - The ReadableStream from a fetch response
 * @param maxBuffer - Maximum buffer size in bytes before throwing
 */
export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
  maxBuffer: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): AsyncGenerator<any> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      if (buffer.length > maxBuffer) {
        throw new Error("SSE buffer overflow");
      }

      const lines = buffer.split("\n");
      buffer = lines.pop()!;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
          try {
            yield JSON.parse(trimmed.slice(6));
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
