"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import {
  Sun,
  Moon,
  Monitor,
  Key,
  Globe,
  Bell,
  LogOut,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [showOpenai, setShowOpenai] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);

  const themes = [
    { key: "light", label: "Светлая", icon: Sun },
    { key: "dark", label: "Тёмная", icon: Moon },
    { key: "system", label: "Системная", icon: Monitor },
  ] as const;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <h1 className="text-xl font-bold text-text-primary">Настройки</h1>

        {/* Theme */}
        <section>
          <h2 className="text-sm font-semibold text-text-primary mb-3">Тема</h2>
          <div className="flex gap-2">
            {themes.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTheme(key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer",
                  theme === key
                    ? "bg-accent-light text-accent border border-accent/20"
                    : "bg-surface-alt text-text-secondary border border-border hover:border-border-hover"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* API Keys */}
        <section>
          <h2 className="text-sm font-semibold text-text-primary mb-1">
            API-ключи
          </h2>
          <p className="text-xs text-text-muted mb-3">
            Укажите свои API-ключи для прямого подключения к моделям
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1.5">
                OpenAI API Key
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  type={showOpenai ? "text" : "password"}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full h-10 pl-10 pr-10 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors font-mono"
                />
                <button
                  onClick={() => setShowOpenai(!showOpenai)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
                >
                  {showOpenai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1.5">
                Anthropic API Key
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  type={showAnthropic ? "text" : "password"}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full h-10 pl-10 pr-10 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors font-mono"
                />
                <button
                  onClick={() => setShowAnthropic(!showAnthropic)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
                >
                  {showAnthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button variant="primary" size="sm">
              Сохранить ключи
            </Button>
          </div>
        </section>

        {/* Language */}
        <section>
          <h2 className="text-sm font-semibold text-text-primary mb-3">Язык</h2>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-alt border border-border">
            <Globe className="h-4 w-4 text-text-muted" />
            <span className="text-sm text-text-primary">Русский</span>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            Уведомления
          </h2>
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface-alt border border-border">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-text-muted" />
              <span className="text-sm text-text-primary">
                Email-уведомления
              </span>
            </div>
            <button className="w-10 h-6 rounded-full bg-accent relative cursor-pointer transition-colors">
              <div className="w-4 h-4 rounded-full bg-white absolute right-1 top-1 transition-all" />
            </button>
          </div>
        </section>

        {/* Logout */}
        <section className="pt-4 border-t border-border">
          <Button
            variant="ghost"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-error hover:text-error hover:bg-red-50 dark:hover:bg-red-950"
          >
            <LogOut className="h-4 w-4" />
            Выйти из аккаунта
          </Button>
        </section>
      </div>
    </div>
  );
}
