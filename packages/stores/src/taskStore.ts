import { create } from "zustand";
import type { Task, TaskStep } from "@/types/task";

interface TaskState {
  tasks: Task[];
  isTaskPanelOpen: boolean;
  isLoading: boolean;

  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, data: Partial<Task>) => void;
  removeTask: (id: string) => void;
  toggleStep: (taskId: string, stepIndex: number) => void;
  setTaskPanelOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  isTaskPanelOpen: false,
  isLoading: false,

  setTasks: (tasks) => set({ tasks }),

  addTask: (task) =>
    set((s) => ({ tasks: [task, ...s.tasks] })),

  updateTask: (id, data) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...data } : t)),
    })),

  removeTask: (id) =>
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
    })),

  toggleStep: (taskId, stepIndex) =>
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const newSteps = t.steps.map((step, i) =>
          i === stepIndex ? { ...step, done: !step.done } : step
        );
        const doneCount = newSteps.filter((s) => s.done).length;
        const progress = Math.round((doneCount / newSteps.length) * 100);
        const allDone = newSteps.every((s) => s.done);
        return {
          ...t,
          steps: newSteps,
          progress,
          status: allDone ? "COMPLETED" as const : t.status,
        };
      }),
    })),

  setTaskPanelOpen: (isTaskPanelOpen) => set({ isTaskPanelOpen }),
  setLoading: (isLoading) => set({ isLoading }),
}));
