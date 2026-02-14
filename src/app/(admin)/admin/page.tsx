"use client";

import { useState, useEffect } from "react";
import { Users, MessageSquare, BarChart3, Zap } from "lucide-react";
import { StatsCard } from "@/components/admin/StatsCard";

interface Stats {
  totalUsers: number;
  activeToday: number;
  totalMessagesToday: number;
  usersByPlan: Record<string, number>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-28"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-text-primary mb-1">Обзор</h1>
      <p className="text-sm text-text-muted mb-6">Статистика сервиса</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatsCard
          icon={Users}
          label="Всего юзеров"
          value={stats.totalUsers}
          color="text-accent"
        />
        <StatsCard
          icon={Zap}
          label="Активны сегодня"
          value={stats.activeToday}
          color="text-success"
        />
        <StatsCard
          icon={MessageSquare}
          label="Сообщений сегодня"
          value={stats.totalMessagesToday}
          color="text-legal-ref"
        />
        <StatsCard
          icon={BarChart3}
          label="На тарифах"
          value={`${stats.usersByPlan?.pro || 0} Pro / ${stats.usersByPlan?.business || 0} Business`}
          color="text-warning"
        />
      </div>

      {/* Plan distribution */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">
          Распределение по тарифам
        </h2>
        <div className="space-y-3">
          {Object.entries(stats.usersByPlan).map(([slug, count]) => {
            const percentage =
              stats.totalUsers > 0
                ? Math.round((count / stats.totalUsers) * 100)
                : 0;
            return (
              <div key={slug}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-text-secondary capitalize">
                    {slug}
                  </span>
                  <span className="text-sm font-medium text-text-primary">
                    {count} ({percentage}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-alt overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
