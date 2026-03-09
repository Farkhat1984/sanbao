"use client";

import { Cable, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { McpServerManager } from "@sanbao/ui/components/settings/McpServerManager";

export default function McpPage() {
  const router = useRouter();

  return (
    <div className="h-full">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="h-9 w-9 rounded-xl bg-accent-light text-accent flex items-center justify-center">
            <Cable className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">MCP-серверы</h1>
            <p className="text-xs text-text-secondary">
              Подключайте внешние инструменты через Model Context Protocol
            </p>
          </div>
        </div>

        {/* MCP Manager */}
        <div className="bg-surface border border-border rounded-2xl p-5">
          <McpServerManager />
        </div>
      </div>
    </div>
  );
}
