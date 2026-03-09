"use client";

import { useRef } from "react";
import { Upload, Trash2, Image } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface LogoUploadProps {
  logoUrl: string | null;
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: () => void;
}

/** Logo upload/preview/delete card for the files_storage settings category. */
function LogoUpload({ logoUrl, uploading, onUpload, onDelete }: LogoUploadProps) {
  const logoInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 mb-4">
      <label className="text-sm font-semibold text-text-primary block mb-3">
        Логотип приложения
      </label>
      <div className="flex items-center gap-4">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            className="h-16 w-16 object-contain rounded-lg border border-border bg-surface-alt p-1"
          />
        ) : (
          <div className="h-16 w-16 rounded-lg border border-border bg-surface-alt flex items-center justify-center">
            <Image className="h-6 w-6 text-text-secondary" />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={(e) => {
              onUpload(e);
              if (logoInputRef.current) logoInputRef.current.value = "";
            }}
            className="hidden"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => logoInputRef.current?.click()}
            isLoading={uploading}
          >
            <Upload className="h-3.5 w-3.5" /> Загрузить
          </Button>
          {logoUrl && (
            <Button variant="secondary" size="sm" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Удалить
            </Button>
          )}
          <p className="text-xs text-text-secondary">
            PNG, JPEG, SVG, WebP. Макс. 512 КБ.
          </p>
        </div>
      </div>
    </div>
  );
}

export { LogoUpload };
