export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";

export type ArtifactType =
  | "CONTRACT"
  | "CLAIM"
  | "COMPLAINT"
  | "DOCUMENT"
  | "CODE"
  | "ANALYSIS";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  reasoning?: string;
  toolName?: string;
  toolResult?: Record<string, unknown>;
  legalRefs?: LegalRef[];
  artifacts?: ArtifactData[];
  createdAt: string;
}

export type AIProvider = "openai" | "anthropic" | "deepinfra";

export interface LegalRef {
  id: string;
  articleCode: string;
  articleTitle: string;
  articleText: string;
  sourceUrl?: string;
  isActual: boolean;
}

export interface ArtifactData {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  version: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationSummary {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  agentId?: string | null;
  agentName?: string | null;
  agentIcon?: string | null;
  agentIconColor?: string | null;
}

export interface Conversation extends ConversationSummary {
  messages: ChatMessage[];
  artifacts: ArtifactData[];
}
