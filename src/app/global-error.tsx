"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", backgroundColor: "#f8f9fb", color: "#1a1d2e" }}>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "16px", textAlign: "center" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600 }}>
            Произошла критическая ошибка
          </h2>
          <p style={{ fontSize: "14px", color: "#6b7280", maxWidth: "400px" }}>
            Приложение столкнулось с непредвиденной проблемой. Попробуйте обновить страницу.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "8px",
              padding: "10px 24px",
              borderRadius: "12px",
              backgroundColor: "#4F6EF7",
              color: "white",
              fontSize: "14px",
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
            }}
          >
            Попробовать снова
          </button>
        </div>
      </body>
    </html>
  );
}
