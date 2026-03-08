export interface Skill {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  templates: unknown[] | null;
  citationRules: string | null;
  jurisdiction: string | null;
  icon: string;
  iconColor: string;
  isBuiltIn: boolean;
  isPublic: boolean;
  category: string;
  tags: string[];
  version: number;
  usageCount: number;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkillSummary {
  id: string;
  name: string;
  description: string | null;
  jurisdiction: string | null;
  icon: string;
  iconColor: string;
  isBuiltIn: boolean;
  isPublic: boolean;
  category: string;
  tags: string[];
  usageCount: number;
}

export interface SkillFormData {
  name: string;
  description?: string;
  systemPrompt: string;
  templates?: unknown[];
  citationRules?: string;
  jurisdiction?: string;
  icon: string;
  iconColor: string;
  category?: string;
  tags?: string[];
}
