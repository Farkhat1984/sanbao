import { CompassRose } from "@/components/icons";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg dot-grid flex items-center justify-center p-4 relative overflow-hidden safe-area-pad">
      {/* Decorative compass rose watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <CompassRose size={600} className="text-accent" opacity={0.03} />
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
