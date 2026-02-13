import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Сегодня";
  if (days === 1) return "Вчера";
  if (days < 7) return `${days} дн. назад`;

  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function groupByDate<T extends { createdAt: string | Date; updatedAt: string | Date }>(
  items: T[],
  dateField: "createdAt" | "updatedAt" = "updatedAt"
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};

  for (const item of items) {
    const label = formatDate(item[dateField]);
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }

  return groups;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}
