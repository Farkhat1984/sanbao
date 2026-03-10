"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { CapacitorBridge } from "@/components/CapacitorBridge";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
      <SessionProvider>
        <CapacitorBridge />
        {children}
      </SessionProvider>
    </ThemeProvider>
  );
}
