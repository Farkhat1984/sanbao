"use client";

import { useRef } from "react";
import { Upload, X } from "lucide-react";

interface AvatarUploadProps {
  avatar: string | null;
  onAvatarChange: (b64: string | null) => void;
}

function resizeImage(dataUrl: string, size: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      // Crop to square from center
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = dataUrl;
  });
}

export function AvatarUpload({ avatar, onAvatarChange }: AvatarUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const resized = await resizeImage(reader.result as string, 200);
      onAvatarChange(resized);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="flex items-start gap-4">
      {/* Preview */}
      <div className="relative shrink-0">
        <div className="h-20 w-20 rounded-full bg-surface-alt border border-border overflow-hidden flex items-center justify-center">
          {avatar ? (
            <img src={avatar} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl text-text-muted">👤</span>
          )}
        </div>
        {avatar && (
          <button
            type="button"
            onClick={() => onAvatarChange(null)}
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-error text-white flex items-center justify-center cursor-pointer hover:bg-error/80 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2 flex-1">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="h-8 px-3 rounded-lg border border-border bg-surface text-xs text-text-muted hover:text-text-primary flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            Загрузить
          </button>
        </div>
      </div>
    </div>
  );
}
