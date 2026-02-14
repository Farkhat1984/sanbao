export interface TaskStep {
  text: string;
  done: boolean;
}

export type TaskStatus = "IN_PROGRESS" | "COMPLETED" | "PAUSED" | "FAILED";

export interface Task {
  id: string;
  title: string;
  steps: TaskStep[];
  status: TaskStatus;
  progress: number;
  conversationId: string | null;
  conversationTitle?: string;
  createdAt: string;
  updatedAt: string;
}
