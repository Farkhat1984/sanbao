"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scale, Mail, Lock, User, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ошибка регистрации");
        setLoading(false);
        return;
      }

      router.push("/login");
    } catch {
      setError("Ошибка сети");
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 20, stiffness: 200 }}
      className="w-full max-w-sm"
    >
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent to-legal-ref flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Scale className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary">
          Создать аккаунт
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Начните работу с Leema
        </p>
      </div>

      {/* Form */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">
              Имя
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">
              Пароль
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 8 символов"
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                minLength={8}
                required
              />
            </div>
          </div>

          {error && <p className="text-xs text-error">{error}</p>}

          <Button
            type="submit"
            variant="gradient"
            size="lg"
            className="w-full"
            isLoading={loading}
          >
            Зарегистрироваться
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Login link */}
      <p className="text-center text-xs text-text-muted mt-4">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-accent hover:text-accent-hover transition-colors">
          Войти
        </Link>
      </p>

      {/* Legal links */}
      <p className="text-center text-[11px] text-text-muted mt-4 leading-relaxed">
        Регистрируясь, вы принимаете{" "}
        <Link href="/offer" className="text-accent hover:text-accent-hover transition-colors">
          публичную оферту
        </Link>{" "}
        и{" "}
        <Link href="/privacy" className="text-accent hover:text-accent-hover transition-colors">
          политику конфиденциальности
        </Link>
      </p>
    </motion.div>
  );
}
