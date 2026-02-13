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
  files: AgentFile[];
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
}
