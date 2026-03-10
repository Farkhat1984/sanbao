"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Capacitor native bridge — handles Android back button, splash screen,
 * and status bar when the web app runs inside a Capacitor WebView.
 * Uses the raw bridge API injected by the native shell (no extra npm deps).
 */
export function CapacitorBridge() {
  const router = useRouter();

  useEffect(() => {
    const cap = (window as Record<string, unknown>).Capacitor as
      | {
          isNativePlatform: () => boolean;
          Plugins: Record<string, Record<string, (...args: unknown[]) => unknown>>;
        }
      | undefined;

    if (!cap?.isNativePlatform()) return;

    // Hide splash screen
    cap.Plugins.SplashScreen?.hide?.();

    // Android back button
    const backPromise = cap.Plugins.App?.addListener?.(
      "backButton",
      ({ canGoBack }: { canGoBack: boolean }) => {
        if (canGoBack) {
          router.back();
        } else {
          cap.Plugins.App?.exitApp?.();
        }
      }
    ) as Promise<{ remove: () => void }> | undefined;

    // Add capacitor-native class to body for CSS targeting
    document.body.classList.add("capacitor-native");

    return () => {
      backPromise?.then((l) => l.remove?.());
      document.body.classList.remove("capacitor-native");
    };
  }, [router]);

  return null;
}
