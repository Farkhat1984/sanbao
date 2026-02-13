"use client";

import { Scale, FileText, Gavel, Search, ShieldCheck, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";

const quickActions = [
  {
    icon: FileText,
    title: "Составить договор",
    desc: "Создание договора с нуля или по шаблону",
    prompt: "Помоги составить договор оказания услуг между ООО и физическим лицом",
  },
  {
    icon: Gavel,
    title: "Подготовить иск",
    desc: "Исковое заявление в суд",
    prompt: "Помоги подготовить исковое заявление о взыскании задолженности",
  },
  {
    icon: Search,
    title: "Найти статью закона",
    desc: "Поиск по НПА с проверкой актуальности",
    prompt: "Найди актуальную редакцию статьи 309 ГК РФ и поясни её применение",
  },
  {
    icon: ShieldCheck,
    title: "Проверить документ",
    desc: "Анализ юридического документа",
    prompt: "Проанализируй прикреплённый договор на юридические риски",
  },
  {
    icon: BookOpen,
    title: "Юридическая консультация",
    desc: "Ответ на правовой вопрос",
    prompt: "Какие права имеет потребитель при возврате товара надлежащего качества?",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export function WelcomeScreen() {
  const { addMessage, setStreaming } = useChatStore();

  const handleQuickAction = (prompt: string) => {
    addMessage({
      id: crypto.randomUUID(),
      role: "USER",
      content: prompt,
      createdAt: new Date().toISOString(),
    });

    // TODO: trigger real API call
    setStreaming(true);
    setTimeout(() => {
      addMessage({
        id: crypto.randomUUID(),
        role: "ASSISTANT",
        content:
          "Это демо-ответ. Реальный AI-ответ будет отображаться здесь с полным стримингом и ссылками на статьи НПА.",
        createdAt: new Date().toISOString(),
      });
      setStreaming(false);
    }, 1500);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 200 }}
        className="text-center mb-10"
      >
        {/* Logo */}
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-accent to-legal-ref flex items-center justify-center mx-auto mb-5 shadow-lg">
          <Scale className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          Добро пожаловать в Leema
        </h2>
        <p className="text-sm text-text-secondary max-w-md">
          Ваш AI-помощник для работы с законодательством. Задайте вопрос, создайте документ или проанализируйте НПА.
        </p>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl w-full"
      >
        {quickActions.map((action) => (
          <motion.button
            key={action.title}
            variants={itemVariants}
            onClick={() => handleQuickAction(action.prompt)}
            className="group text-left p-4 rounded-2xl border border-border bg-surface hover:bg-surface-alt hover:border-border-hover transition-all duration-200 cursor-pointer"
          >
            <div className="h-9 w-9 rounded-xl bg-accent-light flex items-center justify-center mb-3 group-hover:bg-accent group-hover:text-white transition-colors">
              <action.icon className="h-4 w-4 text-accent group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary mb-0.5">
              {action.title}
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {action.desc}
            </p>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
