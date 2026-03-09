/**
 * Full-screen loading indicator for initial app load / auth check.
 */

export function LoadingScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[var(--bg)]">
      <div className="mb-4 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
        Sanbao
      </div>
      <div className="h-1 w-24 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full w-1/2 rounded-full bg-[var(--accent)]"
          style={{
            animation: 'slide 1.2s ease-in-out infinite',
          }}
        />
      </div>
      <style>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  )
}
