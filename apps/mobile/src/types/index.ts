/** User profile returned from /api/user */
export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: 'USER' | 'ADMIN';
  locale: string;
  timezone: string;
  createdAt: string;
}

/** Conversation list item */
export interface ConversationItem {
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
}

/** Agent summary for lists */
export interface AgentSummary {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  iconColor: string;
  isSystem: boolean;
  category?: string | null;
}

/** Agent detail */
export interface AgentDetail extends AgentSummary {
  systemPrompt: string | null;
  starterPrompts: string[];
  tools: AgentToolInfo[];
}

/** Agent tool info */
export interface AgentToolInfo {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  iconColor: string;
}

/** Plan info for billing */
export interface PlanInfo {
  slug: string;
  name: string;
  description: string | null;
  price: number;
  messagesPerDay: number;
  tokensPerMessage: number;
  tokensPerMonth: number;
  canUseAdvancedTools: boolean;
  canUseReasoning: boolean;
  canUseSkills: boolean;
  highlighted?: boolean;
}

/** Usage info */
export interface UsageInfo {
  messageCount: number;
  tokenCount: number;
}

/** Chat message */
export interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  reasoning?: string;
  planContent?: string;
  toolName?: string;
  createdAt: string;
}

/** NDJSON stream chunk from /api/chat */
export interface StreamChunk {
  /** c=content, r=reasoning, p=plan, s=status, x=context, e=error */
  t: 'c' | 'r' | 'p' | 's' | 'x' | 'e';
  v: string;
}

/** Auth tokens stored in Preferences */
export interface AuthTokens {
  accessToken: string;
  expiresAt?: number;
}
