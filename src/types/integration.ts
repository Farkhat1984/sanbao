export interface Integration {
  id: string;
  userId: string;
  name: string;
  type: string;
  baseUrl: string;
  status: string;
  statusMessage: string | null;
  catalog: string | null;
  discoveredEntities: Record<string, unknown> | null;
  entityCount: number;
  lastDiscoveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationSummary {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  status: string;
  statusMessage: string | null;
  entityCount: number;
  lastDiscoveredAt: string | null;
}

export interface IntegrationFormData {
  name: string;
  type: string;
  baseUrl: string;
  username: string;
  password: string;
}

export interface WhatsAppCredentials {
  instanceId: string;
  apiKey: string;
}
