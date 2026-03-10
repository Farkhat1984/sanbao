"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { springTransition } from "@sanbao/shared/animations";
import { SanbaoCompass } from "@sanbao/ui/components/ui/SanbaoCompass";
import Link from "next/link";

/* ─── Capacitor bridge types ──────────────────────────── */

interface CapacitorBridge {
  isNativePlatform: () => boolean;
  Plugins: Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;
}

function getCapacitor(): CapacitorBridge | null {
  if (typeof window === "undefined") return null;
  const cap = (window as Record<string, unknown>).Capacitor as CapacitorBridge | undefined;
  return cap?.isNativePlatform?.() ? cap : null;
}

/** Wait for Capacitor bridge (may be injected after page load on remote URLs) */
function waitForCapacitor(maxMs = 1500): Promise<CapacitorBridge | null> {
  const cap = getCapacitor();
  if (cap) return Promise.resolve(cap);

  return new Promise((resolve) => {
    const start = Date.now();
    const iv = setInterval(() => {
      const c = getCapacitor();
      if (c || Date.now() - start > maxMs) {
        clearInterval(iv);
        resolve(c);
      }
    }, 50);
  });
}

const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

export default function LoginPage() {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = useState("");
  const [isNative, setIsNative] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    waitForCapacitor().then((cap) => {
      const native = !!cap;
      setIsNative(native);
      // Debug: log to see if bridge is detected
      console.log("[LoginPage] Capacitor detected:", native, "window.Capacitor:", typeof (window as Record<string, unknown>).Capacitor);
    });

    fetch("/api/auth/csrf")
      .then((r) => r.json())
      .then((d) => setCsrfToken(d.csrfToken))
      .catch(() => {});
  }, []);

  /** Native Google Sign-In via Capacitor plugin → set NextAuth cookie */
  const handleNativeGoogleLogin = useCallback(async () => {
    const cap = getCapacitor();
    if (!cap) return;

    setLoading(true);
    setError("");

    try {
      // Plugin is configured via capacitor.config.ts (GoogleAuth section)
      // Trigger native Google Sign-In dialog
      const result = (await cap.Plugins.GoogleAuth.signIn()) as {
        authentication: { idToken: string };
      };

      const idToken = result?.authentication?.idToken;
      if (!idToken) throw new Error("No ID token received");

      // Exchange ID token for NextAuth session token
      const res = await fetch("/api/auth/mobile/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Authentication failed");
      }

      const data = (await res.json()) as { accessToken: string };

      // Set NextAuth session cookie so the web app recognizes the session
      const maxAge = 30 * 24 * 60 * 60; // 30 days
      const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
      document.cookie = `${SESSION_COOKIE}=${data.accessToken}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;

      // Navigate to chat
      router.push("/chat");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа через Google");
    } finally {
      setLoading(false);
    }
  }, [router]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springTransition}
      className="w-full max-w-4xl flex rounded-2xl overflow-hidden shadow-xl border border-border"
    >
      {/* Left panel — brand showcase (hidden on mobile) */}
      <div className="hidden md:flex w-[45%] bg-[#1C2B3A] flex-col items-center justify-center p-10 text-center">
        <SanbaoCompass size={64} className="text-accent mx-auto mb-6" state="idle" />
        <h2 className="text-2xl font-bold text-[#F4EFE6] mb-3 font-[family-name:var(--font-display)] tracking-wide">
          Sanbao<span className="text-accent">.ai</span>
        </h2>
        <p className="text-[#9AABB8] text-sm leading-relaxed max-w-[260px] mx-auto">
          Мультиагентная AI-платформа для профессионалов
        </p>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 bg-surface p-6 sm:p-10 flex flex-col items-center justify-center">
        {/* Mobile-only logo */}
        <div className="md:hidden text-center mb-8">
          <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center mx-auto mb-4 shadow-lg">
            <SanbaoCompass size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Sanbao AI</h1>
          <p className="text-sm text-text-secondary mt-1">AI-платформа для профессионалов</p>
        </div>

        {/* Desktop heading */}
        <div className="hidden md:block text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">Добро пожаловать</h1>
          <p className="text-sm text-text-secondary mt-1">Войдите для продолжения работы</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="w-full max-w-sm mb-4 p-3 rounded-xl bg-error/10 border border-error/20 text-sm text-error text-center">
            {error}
          </div>
        )}

        {/* Google Sign-In */}
        <div className="w-full max-w-sm">
          {isNative ? (
            /* Capacitor native Google Sign-In */
            <button
              type="button"
              onClick={handleNativeGoogleLogin}
              disabled={loading}
              className="w-full h-11 rounded-xl border border-border bg-surface text-sm font-medium text-text-primary hover:bg-surface-alt flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-spin h-4 w-4 border-2 border-text-muted border-t-accent rounded-full" />
              ) : (
                <GoogleIcon />
              )}
              {loading ? "Входим..." : "Войти через Google"}
            </button>
          ) : (
            /* Standard web OAuth form */
            <form action="/api/auth/signin/google" method="post">
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input type="hidden" name="callbackUrl" value="/chat" />
              <button
                type="submit"
                className="w-full h-11 rounded-xl border border-border bg-surface text-sm font-medium text-text-primary hover:bg-surface-alt flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
              >
                <GoogleIcon />
                Войти через Google
              </button>
            </form>
          )}

          <p className="text-center text-[11px] text-text-secondary mt-4 leading-relaxed">
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

        {/* Register link */}
        <p className="text-center text-xs text-text-secondary mt-6">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-accent hover:text-accent-hover transition-colors">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </motion.div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
