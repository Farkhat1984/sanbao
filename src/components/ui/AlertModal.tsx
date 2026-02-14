"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type AlertVariant = "error" | "success" | "info";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  variant?: AlertVariant;
  buttonText?: string;
}

const variantConfig: Record<
  AlertVariant,
  { icon: typeof Info; iconBg: string; iconColor: string }
> = {
  error: {
    icon: AlertCircle,
    iconBg: "bg-red-100 dark:bg-red-950/50",
    iconColor: "text-red-500",
  },
  success: {
    icon: CheckCircle,
    iconBg: "bg-emerald-100 dark:bg-emerald-950/50",
    iconColor: "text-emerald-500",
  },
  info: {
    icon: Info,
    iconBg: "bg-accent-light dark:bg-accent/20",
    iconColor: "text-accent",
  },
};

export function AlertModal({
  isOpen,
  onClose,
  title,
  description,
  variant = "error",
  buttonText = "Понятно",
}: AlertModalProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

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
            onClick={onClose}
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
                <p className="text-sm text-text-secondary leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              autoFocus
              className="mt-5 w-full h-9 rounded-xl text-sm font-medium bg-surface-alt text-text-primary border border-border hover:bg-surface-hover hover:border-border-hover transition-all cursor-pointer active:scale-[0.98]"
            >
              {buttonText}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
