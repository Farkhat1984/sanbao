"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="h-16 w-16 rounded-2xl bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
        <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-text-primary">
        Произошла ошибка
      </h2>
      <p className="text-sm text-text-muted max-w-md">
        Что-то пошло не так. Попробуйте обновить страницу или повторить действие.
      </p>
      <button
        onClick={reset}
        className="mt-2 px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors cursor-pointer"
      >
        Попробовать снова
      </button>
    </div>
  );
}
