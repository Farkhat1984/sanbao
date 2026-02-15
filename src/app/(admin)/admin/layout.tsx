import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AdminNavLinks } from "@/components/admin/AdminNavLinks";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, name: true },
  });
  if (user?.role !== "ADMIN") redirect("/chat");

  return (
    <div className="h-screen flex bg-bg">
      {/* Admin Sidebar */}
      <aside className="w-[240px] h-screen flex flex-col border-r border-border bg-surface shrink-0">
        {/* Logo */}
        <div className="p-4 h-14 flex items-center gap-2 border-b border-border">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-accent to-legal-ref flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-text-primary text-sm">
            Админ-панель
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          <AdminNavLinks />
        </nav>

        {/* Back to chat */}
        <div className="p-3 border-t border-border">
          <Link
            href="/chat"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Вернуться в чат
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
