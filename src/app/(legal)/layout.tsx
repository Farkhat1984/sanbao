"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SanbaoCompass } from "@/components/ui/SanbaoCompass";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-surface/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Назад</span>
          </Link>
          <Link href="/login" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-accent to-legal-ref flex items-center justify-center">
              <SanbaoCompass size={18} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-text-primary">Sanbao</span>
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        {children}
      </main>
      <footer className="border-t border-border py-6">
        <div className="max-w-3xl mx-auto px-6 flex flex-wrap gap-4 text-xs text-text-muted">
          <Link href="/terms" className="hover:text-text-secondary transition-colors">Пользовательское соглашение</Link>
          <Link href="/privacy" className="hover:text-text-secondary transition-colors">Политика конфиденциальности</Link>
          <Link href="/offer" className="hover:text-text-secondary transition-colors">Публичная оферта</Link>
        </div>
      </footer>
    </div>
  );
}
