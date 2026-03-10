"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Network, Bot } from "lucide-react";
import { SanbaoCompass } from "@/components/ui/SanbaoCompass";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem, springTransition } from "@/lib/animations";
import { useChatStore } from "@/stores/chatStore";
import { useAgentStore } from "@/stores/agentStore";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";

interface SwarmInfo {
  orgName: string;
  agents: Array<{ name: string; description: string | null }>;
}

export function WelcomeScreen() {
  const { activeAgentId, setPendingInput, swarmMode, swarmOrgId } = useChatStore();
  const { activeAgent, agentTools } = useAgentStore();

  const hasAgent = !!activeAgentId && !!activeAgent;

  // Swarm mode info — reset when leaving swarm mode, fetch when entering
  const [swarmInfo, setSwarmInfo] = useState<SwarmInfo | null>(null);
  const swarmKey = swarmMode && swarmOrgId ? swarmOrgId : null;

  useEffect(() => {
    if (!swarmKey) {
      setSwarmInfo(null);
      return;
    }
    let cancelled = false;
    fetch("/api/organizations/my-agents")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        const orgAgents = data.filter((a: { orgId: string }) => a.orgId === swarmKey);
        if (orgAgents.length > 0) {
          setSwarmInfo({
            orgName: orgAgents[0].orgName,
            agents: orgAgents.map((a: { name: string; description: string | null }) => ({
              name: a.name,
              description: a.description,
            })),
          });
        }
      })
      .catch(console.error);
    return () => { cancelled = true; };
  }, [swarmKey]);

  const isSwarm = swarmMode && swarmInfo;

  const handleQuickAction = (prompt: string) => {
    setPendingInput(prompt);
  };

  // Build quick actions from agent tools
  const toolActions = agentTools
    .filter((t) => {
      const config = t.config as { prompt?: string };
      return !!config?.prompt;
    })
    .map((t) => {
      const Icon = ICON_MAP[t.icon] || ICON_MAP.Wrench;
      const config = t.config as { prompt?: string };
      return {
        key: t.id,
        icon: Icon,
        title: t.name,
        desc: t.description || "",
        prompt: config.prompt || "",
        iconColor: t.iconColor,
      };
    });

  return (
    <div className="h-full flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springTransition}
        className="text-center mb-10"
      >
        {/* Logo / Agent Icon / Swarm Icon */}
        {isSwarm ? (
          <>
            <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-5 shadow-lg">
              <Network className="h-8 w-8 text-amber-500" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              Мультиагент
            </h2>
            <p className="text-sm text-text-secondary max-w-md">
              {swarmInfo.orgName} · {swarmInfo.agents.length} агентов доступно
            </p>
          </>
        ) : hasAgent ? (() => {
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
                {activeAgent.description || "AI-агент. Задайте вопрос, чтобы начать."}
              </p>
            </>
          );
        })() : (
          <>
            <div className="h-16 w-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-5 shadow-lg">
              <SanbaoCompass size={32} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-2 font-[family-name:var(--font-display)]">
              Sanbao<span className="text-accent">.ai</span>
            </h2>
            <p className="text-sm text-text-secondary max-w-md">
              Мультиагентная AI-платформа для профессионалов. Подключайте агентов, базы знаний и инструменты — решайте задачи любой сложности.
            </p>
          </>
        )}
      </motion.div>

      {/* Swarm agent cards */}
      {isSwarm && swarmInfo.agents.length > 0 && toolActions.length === 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl w-full"
        >
          {swarmInfo.agents.map((agent, i) => (
            <motion.div
              key={i}
              variants={staggerItem}
              className="text-left p-4 rounded-2xl border border-border bg-surface"
            >
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
                <Bot className="h-4 w-4 text-amber-500" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-0.5">
                {agent.name}
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                {agent.description || "AI-агент"}
              </p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Starter prompts from agent */}
      {hasAgent && activeAgent.starterPrompts && activeAgent.starterPrompts.length > 0 && toolActions.length === 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-wrap justify-center gap-2 max-w-2xl w-full"
        >
          {activeAgent.starterPrompts.map((prompt, i) => (
            <motion.button
              key={i}
              variants={staggerItem}
              onClick={() => handleQuickAction(prompt)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-border bg-surface hover:bg-surface-alt hover:border-border-hover text-sm text-text-primary transition-all duration-200 cursor-pointer group"
            >
              <span className="line-clamp-1">{prompt}</span>
              <ArrowRight className="h-3.5 w-3.5 text-text-secondary group-hover:text-accent transition-colors shrink-0" />
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Quick Actions from agent tools */}
      {toolActions.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl w-full"
        >
          {toolActions.map((action) => (
            <motion.button
              key={action.key}
              variants={staggerItem}
              onClick={() => handleQuickAction(action.prompt)}
              className="group text-left p-4 rounded-2xl border border-border bg-surface hover:bg-surface-alt hover:border-border-hover transition-all duration-200 cursor-pointer"
            >
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center mb-3 transition-colors"
                style={{ backgroundColor: `${action.iconColor}15` }}
              >
                <action.icon className="h-4 w-4" style={{ color: action.iconColor }} />
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-0.5">
                {action.title}
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                {action.desc}
              </p>
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
