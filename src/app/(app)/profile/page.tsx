"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AvatarUpload } from "@/components/agents/AvatarUpload";
import { Mail, Calendar, Shield, Sparkles } from "lucide-react";

export default function ProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user;
  const [planName, setPlanName] = useState("Free");
  const [userAvatar, setUserAvatar] = useState<string | null>(user?.image || null);

  const handleAvatarChange = async (avatar: string | null) => {
    setUserAvatar(avatar);
    await fetch("/api/user/avatar", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar }),
    });
  };

  useEffect(() => {
    fetch("/api/billing/current")
      .then((r) => r.json())
      .then((data) => {
        if (data.plan?.name) setPlanName(data.plan.name);
      });
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-text-primary mb-6">Профиль</h1>

        {/* User Card */}
        <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <AvatarUpload avatar={userAvatar} onAvatarChange={handleAvatarChange} />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                {user?.name || "Пользователь"}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="h-3.5 w-3.5 text-text-muted" />
                <span className="text-sm text-text-secondary">
                  {user?.email || "—"}
                </span>
              </div>
            </div>
            <Badge variant="accent" className="ml-auto">
              <Sparkles className="h-3 w-3" />
              {planName}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-surface-alt">
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <Calendar className="h-3.5 w-3.5" />
                <span className="text-xs">Дата регистрации</span>
              </div>
              <span className="text-sm font-medium text-text-primary">
                {new Date().toLocaleDateString("ru-RU")}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-surface-alt">
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <Shield className="h-3.5 w-3.5" />
                <span className="text-xs">Роль</span>
              </div>
              <span className="text-sm font-medium text-text-primary">
                {user?.role === "ADMIN" ? "Администратор" : "Пользователь"}
              </span>
            </div>
          </div>
        </div>

        {/* Upgrade Card */}
        <div className="bg-gradient-to-r from-accent to-legal-ref rounded-2xl p-6 text-white">
          <h3 className="text-lg font-bold mb-2">Sanbao Pro</h3>
          <p className="text-sm opacity-90 mb-4">
            Расширенные юридические инструменты, приоритетный доступ к AI,
            экспорт в DOCX/PDF и безлимитная история.
          </p>
          <Button
            variant="secondary"
            className="bg-white/20 border-white/30 text-white hover:bg-white/30"
            onClick={() => router.push("/billing")}
          >
            Посмотреть тарифы
          </Button>
        </div>
      </div>
    </div>
  );
}
