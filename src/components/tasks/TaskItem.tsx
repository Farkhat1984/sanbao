"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTaskStore } from "@/stores/taskStore";
import { TaskStepList } from "./TaskStepList";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/task";

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "В работе",
  COMPLETED: "Завершена",
  PAUSED: "Пауза",
  FAILED: "Ошибка",
};

const STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: "bg-accent",
  COMPLETED: "bg-emerald-500",
  PAUSED: "bg-amber-500",
  FAILED: "bg-red-500",
};

interface TaskItemProps {
  task: Task;
}

export function TaskItem({ task }: TaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(task.status === "IN_PROGRESS");
  const { toggleStep, removeTask, updateTask } = useTaskStore();
  const router = useRouter();

  async function handleToggleStep(index: number) {
    toggleStep(task.id, index);

    const newSteps = task.steps.map((s, i) =>
      i === index ? { ...s, done: !s.done } : s
    );

    await fetch(`/api/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: newSteps }),
    });
  }

  async function handleDelete() {
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (res.ok) removeTask(task.id);
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-surface-alt transition-colors cursor-pointer"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-text-muted shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-text-muted shrink-0" />
        )}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-medium text-text-primary truncate">
            {task.title}
          </p>
        </div>
        <span
          className={cn(
            "text-[10px] font-medium text-white px-1.5 py-0.5 rounded",
            STATUS_COLORS[task.status] || "bg-border"
          )}
        >
          {task.progress}%
        </span>
      </button>

      {/* Progress bar */}
      <div className="h-0.5 bg-surface-alt">
        <div
          className={cn(
            "h-full transition-all duration-300",
            STATUS_COLORS[task.status] || "bg-accent"
          )}
          style={{ width: `${task.progress}%` }}
        />
      </div>

      {isExpanded && (
        <div className="px-3 py-2 border-t border-border">
          <TaskStepList steps={task.steps} onToggle={handleToggleStep} />
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
            {task.conversationId && (
              <button
                onClick={() => router.push(`/chat/${task.conversationId}`)}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-text-muted hover:text-accent transition-colors cursor-pointer"
              >
                <ExternalLink className="h-3 w-3" />
                Перейти к чату
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={handleDelete}
              className="p-1 rounded text-text-muted hover:text-error transition-colors cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
