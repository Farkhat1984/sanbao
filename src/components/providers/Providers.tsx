"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
      <SessionProvider>
        {children}
      </SessionProvider>
    </ThemeProvider>
  );
}
