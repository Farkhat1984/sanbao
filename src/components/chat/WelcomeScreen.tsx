"use client";

import {
  Sparkles,
  FileText,
  Globe,
  Code,
  Scale,
  Gavel,
  Search,
  ShieldCheck,
  BookOpen,
} from "lucide-react";
import { motion } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { useAgentStore } from "@/stores/agentStore";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";
import { FEMIDA_ID, FEMIDA_AGENT, isSystemAgent } from "@/lib/system-agents";

// ─── General-purpose quick actions (main chat) ────────────

const generalActions = [
  {
    icon: Sparkles,
    title: "Создать картинку",
    desc: "Сгенерировать изображение по описанию",
    prompt: "Создай изображение: уютная кофейня в дождливый вечер, тёплый свет из окон, акварельный стиль",
  },
  {
    icon: FileText,
    title: "Написать документ",
    desc: "Письмо, статья, план или отчёт",
    prompt: "Помоги написать профессиональное деловое письмо с благодарностью партнёру за сотрудничество",
  },
  {
    icon: Globe,
    title: "Найти в интернете",
    desc: "Поиск актуальной информации в сети",
    prompt: "Найди последние новости и тренды в области искусственного интеллекта за 2025 год",
  },
  {
    icon: Code,
    title: "Написать код",
    desc: "Скрипт, функция или полноценный проект",
    prompt: "Напиши скрипт на Python который парсит CSV файл, анализирует данные и строит график с помощью matplotlib",
  },
];

// ─── Legal quick actions (Фемида) ─────────────────────────

const legalActions = [
  {
    icon: FileText,
    title: "Составить договор",
    desc: "Создание договора с нуля или по шаблону",
    prompt: "Помоги составить договор оказания услуг между ТОО и физическим лицом по законодательству РК",
  },
  {
    icon: Gavel,
    title: "Подготовить иск",
    desc: "Исковое заявление в суд РК",
    prompt: "Помоги подготовить исковое заявление о взыскании задолженности по законодательству РК",
  },
  {
    icon: Search,
    title: "Найти статью закона",
    desc: "Поиск по НПА РК с проверкой актуальности",
    prompt: "Найди актуальную редакцию статьи 272 ГК РК и поясни её применение",
  },
  {
    icon: ShieldCheck,
    title: "Проверить документ",
    desc: "Анализ юридического документа на риски",
    prompt: "Проанализируй прикреплённый договор на юридические риски по законодательству РК",
  },
  {
    icon: BookOpen,
    title: "Юридическая консультация",
    desc: "Ответ на правовой вопрос по законам РК",
    prompt: "Какие права имеет потребитель при возврате товара надлежащего качества по законодательству РК?",
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
  const { activeAgentId, setPendingInput } = useChatStore();
  const { activeAgent } = useAgentStore();

  const isFemida = activeAgentId === FEMIDA_ID;
  const hasUserAgent = activeAgentId && activeAgent && !isSystemAgent(activeAgentId);

  const handleQuickAction = (prompt: string) => {
    setPendingInput(prompt);
  };

  const actions = isFemida ? legalActions : generalActions;

  return (
    <div className="h-full flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 200 }}
        className="text-center mb-10"
      >
        {/* Logo / Agent Icon */}
        {isFemida ? (
          <>
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg"
              style={{ backgroundColor: FEMIDA_AGENT.iconColor }}
            >
              <Scale className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              {FEMIDA_AGENT.name}
            </h2>
            <p className="text-sm text-text-secondary max-w-md">
              {FEMIDA_AGENT.description}
            </p>
          </>
        ) : hasUserAgent ? (() => {
          const AgentIcon = ICON_MAP[activeAgent.icon] || ICON_MAP.Bot;
          return (
            <>
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg"
                style={{ backgroundColor: activeAgent.iconColor }}
              >
                <AgentIcon className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                {activeAgent.name}
              </h2>
              <p className="text-sm text-text-secondary max-w-md">
                {activeAgent.description || "Персональный AI-агент. Задайте вопрос, чтобы начать."}
              </p>
            </>
          );
        })() : (
          <>
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-accent to-legal-ref flex items-center justify-center mx-auto mb-5 shadow-lg">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              Добро пожаловать в Leema
            </h2>
            <p className="text-sm text-text-secondary max-w-md">
              Ваш универсальный AI-помощник. Создавайте контент, пишите код, ищите информацию и решайте любые задачи.
            </p>
          </>
        )}
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl w-full"
      >
        {actions.map((action) => (
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
