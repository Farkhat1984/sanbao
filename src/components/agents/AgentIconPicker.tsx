"use client";

import { useRef } from "react";
import {
  Bot, Scale, Briefcase, Shield, BookOpen, Gavel, FileText,
  Building, User, HeartPulse, GraduationCap, Landmark,
  Code, MessageSquare, Globe, Lightbulb, FileSearch,
  ShieldCheck, ClipboardCheck, Brain, Upload, X,
  Wrench, AlertTriangle, BarChart3, CheckCircle, Search, Sparkles, Triangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VALID_COLORS } from "@/lib/constants";

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
  { name: "FileSearch", component: FileSearch },
  { name: "ShieldCheck", component: ShieldCheck },
  { name: "ClipboardCheck", component: ClipboardCheck },
  { name: "Brain", component: Brain },
  { name: "Wrench", component: Wrench },
  { name: "AlertTriangle", component: AlertTriangle },
  { name: "BarChart3", component: BarChart3 },
  { name: "CheckCircle", component: CheckCircle },
  { name: "Search", component: Search },
  { name: "Sparkles", component: Sparkles },
  { name: "Triangle", component: Triangle },
] as const;

const COLORS = VALID_COLORS;

// Reusable map for rendering agent icons by name
export const ICON_MAP: Record<string, typeof Bot> = Object.fromEntries(
  ICONS.map((i) => [i.name, i.component])
);

function resizeImage(dataUrl: string, size: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = dataUrl;
  });
}

interface AgentIconPickerProps {
  selectedIcon: string;
  selectedColor: string;
  customImage?: string | null;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
  onCustomImageChange?: (image: string | null) => void;
}

export function AgentIconPicker({
  selectedIcon,
  selectedColor,
  customImage,
  onIconChange,
  onColorChange,
  onCustomImageChange,
}: AgentIconPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onCustomImageChange) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const resized = await resizeImage(reader.result as string, 200);
      onCustomImageChange(resized);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSelectIcon = (name: string) => {
    onIconChange(name);
    onCustomImageChange?.(null);
  };

  return (
    <div className="space-y-4">
      {/* Preview + Upload button */}
      <div className="flex items-center gap-3">
        {customImage ? (
          <div className="relative">
            <img
              src={customImage}
              alt="Custom icon"
              className="h-12 w-12 rounded-xl object-cover shrink-0"
            />
            <button
              type="button"
              onClick={() => onCustomImageChange?.(null)}
              className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-error text-white flex items-center justify-center cursor-pointer hover:bg-error/80 transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ) : (
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: selectedColor }}
          >
            {(() => {
              const IconComp = ICON_MAP[selectedIcon] || Bot;
              return <IconComp className="h-6 w-6 text-white" />;
            })()}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="h-8 px-3 rounded-lg border border-border bg-surface text-xs text-text-muted hover:text-text-primary flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Upload className="h-3.5 w-3.5" />
          Загрузить иконку
        </button>
      </div>

      {/* Icon Grid */}
      <div>
        <label className="text-xs font-medium text-text-muted mb-2 block">
          Иконка
        </label>
        <div className="grid grid-cols-10 gap-1.5">
          {ICONS.map(({ name, component: Icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => handleSelectIcon(name)}
              className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center transition-all cursor-pointer",
                !customImage && selectedIcon === name
                  ? "bg-accent text-white shadow-sm"
                  : "bg-surface-alt text-text-muted hover:text-text-primary hover:bg-surface-hover"
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Color Picker (hidden when custom image is set) */}
      {!customImage && (
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
      )}
    </div>
  );
}
