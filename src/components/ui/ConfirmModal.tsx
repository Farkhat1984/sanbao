"use client";

import { useRef, useEffect } from "react";
import { AlertTriangle, Trash2, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type ConfirmVariant = "danger" | "warning" | "info";

interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

const variantConfig: Record<
  ConfirmVariant,
  { icon: typeof Trash2; iconBg: string; iconColor: string; btnClass: string }
> = {
  danger: {
    icon: Trash2,
    iconBg: "bg-red-100 dark:bg-red-950/50",
    iconColor: "text-red-500",
    btnClass: "bg-error text-white hover:bg-red-600",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-amber-100 dark:bg-amber-950/50",
    iconColor: "text-amber-500",
    btnClass: "bg-amber-500 text-white hover:bg-amber-600",
  },
  info: {
    icon: Info,
    iconBg: "bg-accent-light dark:bg-accent/20",
    iconColor: "text-accent",
    btnClass: "bg-accent text-white hover:bg-accent-hover",
  },
};

export function ConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title,
  description,
  confirmText = "Удалить",
  cancelText = "Отмена",
  variant = "danger",
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const config = variantConfig[variant];
  const Icon = config.icon;

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    // Focus confirm button
    setTimeout(() => confirmRef.current?.focus(), 100);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-sm bg-surface border border-border rounded-2xl shadow-xl p-6"
          >
            <div className="flex flex-col items-center text-center">
              <div
                className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center mb-4",
                  config.iconBg
                )}
              >
                <Icon className={cn("h-6 w-6", config.iconColor)} />
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1">
                {title}
              </h3>
              {description && (
                <p className="text-sm text-text-secondary mb-5 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={onCancel}
                className="flex-1 h-9 rounded-xl text-sm font-medium bg-surface-alt text-text-primary border border-border hover:bg-surface-hover hover:border-border-hover transition-all cursor-pointer active:scale-[0.98]"
              >
                {cancelText}
              </button>
              <button
                ref={confirmRef}
                onClick={onConfirm}
                className={cn(
                  "flex-1 h-9 rounded-xl text-sm font-medium transition-all cursor-pointer active:scale-[0.98]",
                  config.btnClass
                )}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
