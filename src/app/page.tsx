"use client";

import Link from "next/link";
import { type Variants, motion } from "framer-motion";
import { CompassRose } from "@/components/icons/CompassRose";
import { ScrollIcon } from "@/components/icons/ScrollIcon";
import { SpyglassIcon } from "@/components/icons/SpyglassIcon";
import { LanternIcon } from "@/components/icons/LanternIcon";
import { ShipWheelIcon } from "@/components/icons/ShipWheelIcon";
import { SonarIcon } from "@/components/icons/SonarIcon";
import { SanbaoCompass } from "@sanbao/ui/components/ui/SanbaoCompass";

/* ────────────────────────────────────────────────────────
   Animation Variants
   ──────────────────────────────────────────────────────── */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

/* ────────────────────────────────────────────────────────
   Data
   ──────────────────────────────────────────────────────── */

const AGENTS = [
  {
    name: "Юрист",
    description: "НПА, договоры, иски — 18 кодексов и 344К+ законов",
    Icon: ScrollIcon,
    colorClass: "text-accent",
    bgClass: "bg-accent/10",
  },
  {
    name: "Брокер",
    description: "Классификация, расчёт пошлин, ТНВЭД — 13,279 кодов",
    Icon: SpyglassIcon,
    colorClass: "text-legal-ref",
    bgClass: "bg-legal-ref/10",
  },
  {
    name: "Бухгалтер",
    description: "Учёт, налоги, зарплата — 20,700+ документов 1С",
    Icon: LanternIcon,
    colorClass: "text-accent",
    bgClass: "bg-accent/10",
  },
  {
    name: "1С Консультант",
    description: "Платформа, BSP, EDT, ERP — 39,000+ документов",
    Icon: ShipWheelIcon,
    colorClass: "text-legal-ref",
    bgClass: "bg-legal-ref/10",
  },
] as const;

const FEATURES = [
  {
    title: "Глубокая база знаний",
    description:
      "Не просто поиск — понимание контекста. Векторная семантика, граф связей и BM25 для точных ответов с цитатами первоисточников.",
  },
  {
    title: "MCP интеграция",
    description:
      "Model Context Protocol для подключения любых внешних источников данных. Расширяйте возможности без ограничений.",
  },
  {
    title: "Мультиагентность",
    description:
      "Создавайте собственных AI-агентов с кастомными инструкциями, навыками и подключёнными инструментами.",
  },
] as const;

const PLANS = [
  {
    name: "Бесплатный",
    price: "$0",
    period: "мес",
    features: ["5 сообщений в день", "1 агент", "Базовые инструменты", "Общий доступ"],
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$20",
    period: "мес",
    features: [
      "Безлимитные сообщения",
      "Все агенты",
      "MCP интеграция",
      "Приоритетная поддержка",
    ],
    highlighted: true,
  },
  {
    name: "Business",
    price: "$60",
    period: "мес",
    features: [
      "Всё из Pro",
      "Организации и команды",
      "API доступ",
      "SLA гарантии",
      "Кастомные агенты",
    ],
    highlighted: false,
  },
] as const;

const FOOTER_LINKS = [
  { label: "Оферта", href: "/offer" },
  { label: "Конфиденциальность", href: "/privacy" },
  { label: "Условия", href: "/terms" },
] as const;

/* ────────────────────────────────────────────────────────
   Page Component
   ──────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <main className="overflow-x-hidden">
      <HeroSection />
      <AgentsSection />
      <FeaturesSection />
      <PricingSection />
      <FooterSection />
    </main>
  );
}

/* ────────────────────────────────────────────────────────
   Hero
   ──────────────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="relative flex min-h-dvh flex-col items-center justify-center bg-[#1C2B3A] px-6 py-24 text-center">
      {/* CompassRose watermark */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <CompassRose size={600} className="text-[#F4EFE6]" opacity={0.08} />
      </div>

      {/* Chinese watermark */}
      <span
        className="pointer-events-none absolute right-8 bottom-12 select-none font-[family-name:var(--font-display)] text-[12rem] leading-none text-[#F4EFE6] md:right-16 md:bottom-16 md:text-[18rem]"
        style={{ opacity: 0.05 }}
        aria-hidden="true"
      >
        三宝
      </span>

      {/* Sonar + Compass */}
      <motion.div
        className="relative mb-10"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <SonarIcon size={80} className="absolute -inset-6 m-auto animate-pulse text-accent opacity-30" />
        <SanbaoCompass size={64} className="text-[#F4EFE6]" />
      </motion.div>

      {/* Heading */}
      <motion.h1
        className="relative z-10 mb-6 font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-[#F4EFE6] md:text-6xl lg:text-7xl"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
      >
        Navigate with Intelligence
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        className="relative z-10 mb-10 max-w-2xl text-lg leading-relaxed text-[#9AABB8] md:text-xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
      >
        AI-платформа для юристов, бухгалтеров и таможенных специалистов Казахстана
      </motion.p>

      {/* CTAs */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-4 sm:flex-row sm:gap-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.45, ease: "easeOut" }}
      >
        <Link
          href="/login"
          className="inline-flex items-center rounded-xl bg-accent px-8 py-3 font-semibold text-[#1C2B3A] transition-colors duration-200 hover:bg-accent-hover"
        >
          Начать работу
        </Link>
        <a
          href="#features"
          className="inline-flex items-center text-[#9AABB8] transition-colors duration-200 hover:text-[#F4EFE6]"
        >
          Узнать больше
          <svg
            className="ml-2 h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </a>
      </motion.div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────
   Agents
   ──────────────────────────────────────────────────────── */

function AgentsSection() {
  return (
    <section className="bg-bg px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          className="mb-16 text-center font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-text-primary md:text-4xl"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          Ваши AI-специалисты
        </motion.h2>

        <motion.div
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {AGENTS.map((agent) => (
            <AgentCard key={agent.name} {...agent} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function AgentCard({
  name,
  description,
  Icon,
  colorClass,
  bgClass,
}: (typeof AGENTS)[number]) {
  return (
    <motion.div
      className="rounded-2xl border border-border bg-surface p-6 transition-shadow duration-200 hover:shadow-[var(--shadow-md)]"
      variants={fadeUp}
    >
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${bgClass}`}
      >
        <Icon size={24} className={colorClass} />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-text-primary">{name}</h3>
      <p className="text-sm leading-relaxed text-text-secondary">{description}</p>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────
   Features
   ──────────────────────────────────────────────────────── */

function FeaturesSection() {
  return (
    <section id="features" className="bg-surface-alt px-6 py-24 md:py-32">
      <div className="mx-auto max-w-5xl">
        <motion.h2
          className="mb-20 text-center font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-text-primary md:text-4xl"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          Почему Sanbao
        </motion.h2>

        <div className="space-y-24">
          {FEATURES.map((feature, index) => (
            <FeatureRow key={feature.title} {...feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({
  title,
  description,
  index,
}: (typeof FEATURES)[number] & { index: number }) {
  const isReversed = index % 2 === 1;

  return (
    <motion.div
      className={`flex flex-col items-center gap-8 md:flex-row md:gap-16 ${
        isReversed ? "md:flex-row-reverse" : ""
      }`}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
    >
      {/* Visual element */}
      <div className="flex w-full shrink-0 items-center justify-center md:w-2/5">
        <div className="flex h-40 w-40 items-center justify-center rounded-2xl border border-border bg-surface">
          <FeatureVisual index={index} />
        </div>
      </div>

      {/* Text content */}
      <div className="w-full md:w-3/5">
        <h3 className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-text-primary md:text-2xl">
          {title}
        </h3>
        <p className="text-base leading-relaxed text-text-secondary">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

/** Renders a unique icon composition for each feature row. */
function FeatureVisual({ index }: { index: number }) {
  switch (index) {
    case 0:
      return (
        <div className="relative">
          <CompassRose size={100} className="text-accent" opacity={0.2} />
          <SonarIcon size={40} className="absolute inset-0 m-auto text-accent" />
        </div>
      );
    case 1:
      return (
        <div className="relative flex items-center gap-1">
          <div className="h-10 w-10 rounded-lg border border-accent/30 bg-accent/10" />
          <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <div className="h-10 w-10 rounded-lg border border-legal-ref/30 bg-legal-ref/10" />
          <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <div className="h-10 w-10 rounded-lg border border-accent/30 bg-accent/10" />
        </div>
      );
    case 2:
      return (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-accent/30 bg-accent/10">
            <ScrollIcon size={22} className="text-accent" />
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-legal-ref/30 bg-legal-ref/10">
            <SpyglassIcon size={22} className="text-legal-ref" />
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-legal-ref/30 bg-legal-ref/10">
            <LanternIcon size={22} className="text-legal-ref" />
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-accent/30 bg-accent/10">
            <ShipWheelIcon size={22} className="text-accent" />
          </div>
        </div>
      );
    default:
      return null;
  }
}

/* ────────────────────────────────────────────────────────
   Pricing
   ──────────────────────────────────────────────────────── */

function PricingSection() {
  return (
    <section className="bg-bg px-6 py-24 md:py-32">
      <div className="mx-auto max-w-5xl">
        <motion.h2
          className="mb-4 text-center font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-text-primary md:text-4xl"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          Тарифы
        </motion.h2>
        <motion.p
          className="mb-16 text-center text-text-secondary"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          Начните бесплатно, масштабируйтесь по мере роста
        </motion.p>

        <motion.div
          className="grid grid-cols-1 gap-6 md:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {PLANS.map((plan) => (
            <PlanCard key={plan.name} {...plan} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function PlanCard({
  name,
  price,
  period,
  features,
  highlighted,
}: (typeof PLANS)[number]) {
  return (
    <motion.div
      className={`relative flex flex-col rounded-2xl border p-8 transition-shadow duration-200 hover:shadow-[var(--shadow-lg)] ${
        highlighted
          ? "border-accent bg-surface shadow-[var(--shadow-md)]"
          : "border-border bg-surface"
      }`}
      variants={fadeUp}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-1 text-xs font-semibold text-[#1C2B3A]">
          Популярный
        </span>
      )}

      <h3 className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold text-text-primary">
        {name}
      </h3>

      <div className="mb-6">
        <span className="text-3xl font-bold text-text-primary">{price}</span>
        <span className="text-text-secondary">/{period}</span>
      </div>

      <ul className="mb-8 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-text-secondary">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <Link
        href="/login"
        className={`block rounded-xl px-6 py-3 text-center font-semibold transition-colors duration-200 ${
          highlighted
            ? "bg-accent text-[#1C2B3A] hover:bg-accent-hover"
            : "border border-border bg-transparent text-text-primary hover:bg-surface-hover"
        }`}
      >
        {highlighted ? "Начать с Pro" : "Выбрать"}
      </Link>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────
   Footer
   ──────────────────────────────────────────────────────── */

function FooterSection() {
  return (
    <footer className="bg-[#1C2B3A] px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <motion.div
          className="flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-between"
          variants={fadeIn}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {/* Brand */}
          <div className="flex flex-col items-center md:items-start">
            <div className="mb-3 flex items-center gap-3">
              <SanbaoCompass size={28} className="text-[#F4EFE6]" />
              <span className="font-[family-name:var(--font-display)] text-xl font-bold text-[#F4EFE6]">
                Sanbao
              </span>
              <span className="text-lg text-accent">三宝</span>
            </div>
            <p className="text-sm text-[#9AABB8]">
              AI-платформа для профессионалов
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-6" aria-label="Footer links">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-[#9AABB8] transition-colors duration-200 hover:text-[#F4EFE6]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </motion.div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center gap-2 border-t border-[#2C3E50] pt-8 text-xs text-[#6B8494]">
          <p>&copy; 2024-2026 Sanbao.ai &mdash; Все права защищены</p>
          <p>
            Сделано в Казахстане с{" "}
            <span className="text-error" aria-label="любовью">
              &#9829;
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
