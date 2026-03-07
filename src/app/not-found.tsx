import Link from "next/link";
import { CompassIcon } from "@/components/icons/CompassIcon";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center bg-bg">
      <div className="h-20 w-20 rounded-2xl bg-surface-alt flex items-center justify-center">
        <CompassIcon size={40} className="text-text-muted/40" />
      </div>
      <h1 className="text-4xl font-bold text-text-primary font-[family-name:var(--font-display)]">
        404
      </h1>
      <p className="text-sm text-text-muted max-w-sm">
        Страница не найдена. Возможно, она была перемещена или удалена.
      </p>
      <Link
        href="/"
        className="mt-2 px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
      >
        На главную
      </Link>
    </div>
  );
}
