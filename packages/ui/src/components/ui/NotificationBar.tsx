"use client";

import { Check, X } from "lucide-react";

export interface Notification {
  id: number;
  type: "success" | "error";
  message: string;
}

interface NotificationBarProps {
  notifications: Notification[];
  onDismiss: (id: number) => void;
}

/** Fixed-position toast notification stack. Appears bottom-right with slide-in animation. */
function NotificationBar({ notifications, onDismiss }: NotificationBarProps) {
  if (notifications.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-in slide-in-from-right-5 ${
            n.type === "success"
              ? "bg-success-light text-success border-success/20"
              : "bg-error-light text-error border-error/20"
          }`}
        >
          {n.type === "success" ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <X className="h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">{n.message}</span>
          <button
            onClick={() => onDismiss(n.id)}
            className="shrink-0 opacity-60 hover:opacity-100 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export { NotificationBar };
