/**
 * Strategy pattern for AI stream providers.
 * Adding a new provider only requires implementing StreamProvider
 * and registering it — no changes to route.ts needed.
 */

import type { ResolvedModel } from "@/lib/model-router";
import type { NativeToolContext } from "@/lib/native-tools";
import type { ContextResult } from "@/app/api/chat/context-loader";

export interface StreamRequest {
  context: ContextResult;
  body: {
    messages: Array<{ role: string; content: string }>;
    thinkingEnabled?: boolean;
    conversationId?: string;
  };
  plan: {
    tokensPerMessage: number;
  };
  settings: {
    defaultTemperature: number;
    defaultTopP: number;
    maxToolCallsPerRequest: number;
    maxRequestTokens: number;
    toolResultMaxChars: number;
    toolResultTailChars: number;
  };
  mcpTools: unknown[];
  nativeToolCtx: NativeToolContext;
  textModel: ResolvedModel | null;
  userId: string;
  onUsage: (usage: { inputTokens: number; outputTokens: number }) => void;
  signal: AbortSignal;
}

export interface StreamProvider {
  /** Which apiFormat this provider handles */
  format: string;
  /** Create a ReadableStream or Response body for the given request */
  createStream(req: StreamRequest): ReadableStream | Promise<ReadableStream>;
}

const providers = new Map<string, StreamProvider>();

export function registerStreamProvider(provider: StreamProvider): void {
  providers.set(provider.format, provider);
}

export function getStreamProvider(format: string): StreamProvider | undefined {
  return providers.get(format);
}

export function getRegisteredFormats(): string[] {
  return Array.from(providers.keys());
}
