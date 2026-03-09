// ─── Types matching API response ───

export interface SettingEntry {
  key: string;
  label: string;
  description: string;
  type: "number" | "string" | "boolean";
  value: string;
  defaultValue: string;
  isOverridden: boolean;
  validation?: {
    min?: number;
    max?: number;
    step?: number;
    allowedValues?: string[];
    pattern?: string;
  };
  unit: string;
  sensitive: boolean;
  restartRequired: boolean;
}

export interface SettingsCategory {
  key: string;
  label: string;
  description: string;
  order: number;
  settings: SettingEntry[];
}

export interface ApiResponse {
  categories: SettingsCategory[];
}

export interface Notification {
  id: number;
  type: "success" | "error";
  message: string;
}
