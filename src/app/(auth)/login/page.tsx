"use client";

import { useEffect, useState } from "react";
import { Triangle, ShieldCheck, Brain, Zap } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function LoginPage() {
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    fetch("/api/auth/csrf")
      .then((r) => r.json())
      .then((d) => setCsrfToken(d.csrfToken))
      .catch(() => {});
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 20, stiffness: 200 }}
      className="w-full max-w-sm"
    >
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent to-legal-ref flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Triangle className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Sanbao AI</h1>
        <p className="text-sm text-text-secondary mt-1">
          AI-платформа для профессионалов
        </p>
      </div>

      {/* Features */}
      <div className="flex justify-center gap-6 mb-8">
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-accent" />
          </div>
          <span className="text-[10px] text-text-muted text-center leading-tight">Верификация<br />фактов</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center">
            <Brain className="h-4 w-4 text-accent" />
          </div>
          <span className="text-[10px] text-text-muted text-center leading-tight">SOTA<br />точность</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center">
            <Zap className="h-4 w-4 text-accent" />
          </div>
          <span className="text-[10px] text-text-muted text-center leading-tight">Нативная<br />база знаний</span>
        </div>
      </div>

      {/* Auth */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-lg">
        <form action="/api/auth/signin/google" method="post">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="callbackUrl" value="/chat" />
          <button
            type="submit"
            className="w-full h-11 rounded-xl border border-border bg-surface text-sm font-medium text-text-primary hover:bg-surface-alt flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Войти через Google
          </button>
        </form>

        <p className="text-center text-[11px] text-text-muted mt-4 leading-relaxed">
          Входя в систему, вы принимаете{" "}
          <Link href="/offer" className="text-accent hover:text-accent-hover transition-colors">
            публичную оферту
          </Link>{" "}
          и{" "}
          <Link href="/privacy" className="text-accent hover:text-accent-hover transition-colors">
            политику конфиденциальности
          </Link>
        </p>
      </div>

      {/* Legal links */}
      <div className="flex items-center justify-center gap-3 flex-wrap mt-6 text-[11px] text-text-muted">
        <Link href="/offer" className="hover:text-text-secondary transition-colors">
          Публичная оферта
        </Link>
        <span className="text-border">|</span>
        <Link href="/terms" className="hover:text-text-secondary transition-colors">
          Соглашение
        </Link>
        <span className="text-border">|</span>
        <Link href="/privacy" className="hover:text-text-secondary transition-colors">
          Конфиденциальность
        </Link>
      </div>
    </motion.div>
  );
}
