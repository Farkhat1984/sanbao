"use client";

import {
  Bot, Scale, Briefcase, Shield, BookOpen, Gavel, FileText,
  Building, User, HeartPulse, GraduationCap, Landmark,
  Code, MessageSquare, Globe, Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = [
  { name: "Bot", component: Bot },
  { name: "Scale", component: Scale },
  { name: "Briefcase", component: Briefcase },
  { name: "Shield", component: Shield },
  { name: "BookOpen", component: BookOpen },
  { name: "Gavel", component: Gavel },
  { name: "FileText", component: FileText },
  { name: "Building", component: Building },
  { name: "User", component: User },
  { name: "HeartPulse", component: HeartPulse },
  { name: "GraduationCap", component: GraduationCap },
  { name: "Landmark", component: Landmark },
  { name: "Code", component: Code },
  { name: "MessageSquare", component: MessageSquare },
  { name: "Globe", component: Globe },
  { name: "Lightbulb", component: Lightbulb },
] as const;

const COLORS = [
  "#4F6EF7",
  "#7C3AED",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#06B6D4",
  "#6366F1",
];

// Reusable map for rendering agent icons by name
export const ICON_MAP: Record<string, typeof Bot> = Object.fromEntries(
  ICONS.map((i) => [i.name, i.component])
);

interface AgentIconPickerProps {
  selectedIcon: string;
  selectedColor: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
}

export function AgentIconPicker({
  selectedIcon,
  selectedColor,
  onIconChange,
  onColorChange,
}: AgentIconPickerProps) {
  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="flex items-center gap-3">
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: selectedColor }}
        >
          {(() => {
            const IconComp = ICON_MAP[selectedIcon] || Bot;
            return <IconComp className="h-6 w-6 text-white" />;
          })()}
        </div>
        <span className="text-sm text-text-muted">Превью иконки</span>
      </div>

      {/* Icon Grid */}
      <div>
        <label className="text-xs font-medium text-text-muted mb-2 block">
          Иконка
        </label>
        <div className="grid grid-cols-8 gap-1.5">
          {ICONS.map(({ name, component: Icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => onIconChange(name)}
              className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center transition-all cursor-pointer",
                selectedIcon === name
                  ? "bg-accent text-white shadow-sm"
                  : "bg-surface-alt text-text-muted hover:text-text-primary hover:bg-surface-hover"
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Color Picker */}
      <div>
        <label className="text-xs font-medium text-text-muted mb-2 block">
          Цвет
        </label>
        <div className="flex gap-2">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onColorChange(color)}
              className={cn(
                "h-8 w-8 rounded-full transition-all cursor-pointer",
                selectedColor === color
                  ? "ring-2 ring-offset-2 ring-offset-surface ring-accent scale-110"
                  : "hover:scale-110"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
