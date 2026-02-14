export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  transport: "SSE" | "STREAMABLE_HTTP";
  apiKey: string | null;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  discoveredTools: McpToolInfo[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface McpServerSummary {
  id: string;
  name: string;
  url: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  toolCount: number;
}
