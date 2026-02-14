"use client";

import { useEffect } from "react";
import { useTaskStore } from "@/stores/taskStore";
import { TaskItem } from "./TaskItem";
import { ListChecks } from "lucide-react";

export function TaskPanel() {
  const { tasks, setTasks, setLoading, isLoading } = useTaskStore();

  useEffect(() => {
    setLoading(true);
    fetch("/api/tasks")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setTasks(data);
      })
      .finally(() => setLoading(false));
  }, [setTasks, setLoading]);

  const activeTasks = tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "PAUSED");
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED");

  if (isLoading) {
    return (
      <div className="space-y-2 px-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-12 bg-surface-alt rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <ListChecks className="h-5 w-5 text-text-muted mx-auto mb-1.5" />
        <p className="text-xs text-text-muted">Нет задач</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-3">
      {activeTasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
      {completedTasks.length > 0 && activeTasks.length > 0 && (
        <p className="text-[10px] text-text-muted px-1 pt-1">Завершённые</p>
      )}
      {completedTasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  );
}
