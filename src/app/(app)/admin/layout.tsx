import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") redirect("/chat");

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-text-primary mb-1">
          Админ-панель
        </h1>
        <p className="text-sm text-text-muted mb-6">
          Управление пользователями и тарифами
        </p>
        <AdminNav />
        {children}
      </div>
    </div>
  );
}
