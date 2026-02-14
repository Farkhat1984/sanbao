export interface AgentFile {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
  extractedText?: string | null;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  instructions: string;
  model: string;
  icon: string;
  iconColor: string;
  avatar?: string | null;
  files: AgentFile[];
  skills?: Array<{ id: string; skill: { id: string; name: string; icon: string; iconColor: string } }>;
  mcpServers?: Array<{ id: string; mcpServer: { id: string; name: string; url: string; status: string } }>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSummary {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  iconColor: string;
  model: string;
  avatar?: string | null;
  _count: { conversations: number; files: number };
  updatedAt: string;
}

export interface AgentFormData {
  name: string;
  description?: string;
  instructions: string;
  model: string;
  icon: string;
  iconColor: string;
  avatar?: string | null;
}
