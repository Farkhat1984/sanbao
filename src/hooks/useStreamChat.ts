"use client";

import { useRef, useCallback, useEffect } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useTaskStore } from "@/stores/taskStore";
import { useRouter } from "next/navigation";
import { openArtifactInPanel } from "@/lib/panel-actions";
import type { ArtifactType } from "@/types/chat";
import type { AttachedFile } from "@/hooks/useFileAttachment";

// ─── Types ──────────────────────────────────────────────

export interface UseStreamChatParams {
  input: string;
  setInput: (value: string) => void;
  attachedFiles: AttachedFile[];
  clearFiles: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export interface UseStreamChatReturn {
  doSubmit: (overrideInput?: string) => Promise<void>;
  handleStop: () => void;
}

// ─── Hook ───────────────────────────────────────────────

export function useStreamChat({
  input,
  setInput,
  attachedFiles,
  clearFiles,
  textareaRef,
}: UseStreamChatParams): UseStreamChatReturn {
  const {
    messages,
    isStreaming,
    activeConversationId,
    activeAgentId,
    thinkingEnabled,
    webSearchEnabled,
    planningEnabled,
    pendingInput,
    addMessage,
    addConversation,
    setActiveConversation,
    updateLastAssistantMessage,
    setStreaming,
    setStreamingPhase,
    updateCurrentPlan,
    setCurrentPlan,
    setContextUsage,
    setPendingInput,
    setClarifyQuestions,
  } = useChatStore();

  const { addTask } = useTaskStore();
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  // ─── Auto-submit from tools/templates ────────────────────
  const pendingSubmitRef = useRef(false);
  useEffect(() => {
    if (pendingInput && !isStreaming && !pendingSubmitRef.current) {
      pendingSubmitRef.current = true;
      const pendingValue = pendingInput;
      setPendingInput(null);
      // Defer to next tick so setPendingInput(null) settles first
      queueMicrotask(() => {
        doSubmit(pendingValue);
        pendingSubmitRef.current = false;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInput]);

  // ─── Submit ──────────────────────────────────────────────

  const doSubmit = useCallback(async (overrideInput?: string) => {
    const trimmed = (overrideInput ?? input).trim();
    if ((!trimmed && attachedFiles.length === 0) || isStreaming) return;
    // Don't submit while files are parsing
    if (attachedFiles.some((f) => f.isParsing)) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: "USER" as const,
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    addMessage(userMessage);
    setInput("");
    const filesToSend = [...attachedFiles];
    clearFiles();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setStreaming(true);
    setCurrentPlan(null);
    // Phase is null — will be determined by the first stream chunk

    // Ensure we have a conversation for persistence
    let convId = activeConversationId;
    if (!convId) {
      try {
        const convRes = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmed.slice(0, 60) || "Новый чат",
            agentId: activeAgentId || undefined,
          }),
        });
        if (convRes.ok) {
          const conv = await convRes.json();
          convId = conv.id;
          addConversation(conv);
          setActiveConversation(conv.id);
          router.replace(`/chat/${conv.id}`);
        } else if (convRes.status === 403) {
          const err = await convRes.json().catch(() => ({ error: "Лимит диалогов" }));
          addMessage({
            id: crypto.randomUUID(),
            role: "ASSISTANT",
            content: `Ошибка: ${err.error}`,
            createdAt: new Date().toISOString(),
          });
          setStreaming(false);
          return;
        }
      } catch {
        // Continue without persistence if conversation creation fails
      }
    }

    let fullContent = "";
    let fullPlan = "";

    try {
      const apiMessages = [...messages, userMessage]
        .filter((m) => m.content.trim() !== "")
        .map((m) => ({
          role: m.role.toLowerCase(),
          content: m.content,
        }));

      const attachmentsPayload = filesToSend.map((f) => ({
        name: f.name,
        type: f.type,
        ...(f.base64 ? { base64: f.base64 } : {}),
        ...(f.textContent ? { textContent: f.textContent } : {}),
      }));

      abortRef.current = new AbortController();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          agentId: activeAgentId,
          conversationId: convId,
          thinkingEnabled,
          webSearchEnabled,
          planningEnabled,
          attachments: attachmentsPayload,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Неизвестная ошибка" }));
        addMessage({
          id: crypto.randomUUID(),
          role: "ASSISTANT",
          content: `Ошибка: ${error.error || "Не удалось получить ответ"}`,
          createdAt: new Date().toISOString(),
        });
        setStreaming(false);
        return;
      }

      addMessage({
        id: crypto.randomUUID(),
        role: "ASSISTANT",
        content: "",
        createdAt: new Date().toISOString(),
      });

      // Parse NDJSON stream
      if (!response.body) {
        setStreaming(false);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullReasoning = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop()!;

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            switch (data.t) {
              case "r": // reasoning
                setStreamingPhase("thinking");
                fullReasoning += data.v;
                updateLastAssistantMessage(fullContent, fullReasoning);
                break;
              case "s": // status (searching / using_tool)
                setStreamingPhase(
                  data.v === "using_tool" ? "using_tool" : "searching",
                  data.n || null
                );
                break;
              case "c": // content
                setStreamingPhase("answering");
                fullContent += data.v;
                updateLastAssistantMessage(
                  fullContent,
                  fullReasoning || undefined
                );
                break;
              case "p": // plan content
                setStreamingPhase("planning");
                fullPlan += data.v;
                updateCurrentPlan(data.v);
                updateLastAssistantMessage(
                  fullContent,
                  fullReasoning || undefined,
                  fullPlan
                );
                break;
              case "x": // context info
                try {
                  const info = JSON.parse(data.v);
                  if (info.action === "context_info") {
                    setContextUsage({
                      usagePercent: info.usagePercent,
                      totalTokens: info.totalTokens,
                      contextWindowSize: info.contextWindowSize,
                      isCompacting: info.compacting,
                    });
                  }
                } catch {
                  // ignore malformed context info
                }
                break;
              case "e": // error
                if (!fullContent) {
                  fullContent = `Ошибка: ${data.v}`;
                } else {
                  fullContent += `\n\n_Ошибка: ${data.v}_`;
                }
                updateLastAssistantMessage(fullContent);
                break;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }

      // Save messages to DB after stream completes
      if (convId && fullContent) {
        fetch(`/api/conversations/${convId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "USER", content: trimmed },
              { role: "ASSISTANT", content: fullContent, planContent: fullPlan || undefined },
            ],
          }),
        }).catch(console.error);
      }

      // Detect and create tasks from <sanbao-task> tags
      const taskRegex = /<sanbao-task\s+title="([^"]+)">([\s\S]*?)<\/sanbao-task>/g;
      let taskMatch;
      while ((taskMatch = taskRegex.exec(fullContent)) !== null) {
        const taskTitle = taskMatch[1];
        const taskBody = taskMatch[2];
        const steps = taskBody
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("- ["))
          .map((line) => ({
            text: line.replace(/^- \[[ x]\]\s*/, ""),
            done: line.includes("[x]"),
          }));

        if (steps.length > 0) {
          fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: taskTitle,
              steps,
              conversationId: convId,
            }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((task) => {
              if (task) addTask(task);
            })
            .catch(console.error);
        }
      }

      // Auto-open first artifact
      const docMatch = /<sanbao-doc\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/sanbao-doc>/.exec(fullContent);
      if (docMatch) {
        openArtifactInPanel({
          id: crypto.randomUUID(),
          type: docMatch[1] as ArtifactType,
          title: docMatch[2],
          content: docMatch[3].trim(),
          version: 1,
        });
      }

      // Detect clarify questions from <sanbao-clarify> tag
      const clarifyMatch = /<sanbao-clarify>([\s\S]*?)<\/sanbao-clarify>/.exec(fullContent);
      if (clarifyMatch) {
        try {
          const questions = JSON.parse(clarifyMatch[1]);
          if (Array.isArray(questions) && questions.length > 0) {
            setClarifyQuestions(questions);
          }
        } catch {
          // Skip malformed clarify JSON
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User stopped the stream — save partial content if available
        if (convId && fullContent) {
          fetch(`/api/conversations/${convId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [
                { role: "USER", content: trimmed },
                { role: "ASSISTANT", content: fullContent, planContent: fullPlan || undefined },
              ],
            }),
          }).catch(console.error);
        }
      } else {
        addMessage({
          id: crypto.randomUUID(),
          role: "ASSISTANT",
          content: "Ошибка подключения. Попробуйте позже.",
          createdAt: new Date().toISOString(),
        });
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }, [
    input,
    attachedFiles,
    isStreaming,
    messages,
    activeConversationId,
    activeAgentId,
    thinkingEnabled,
    webSearchEnabled,
    planningEnabled,
    addMessage,
    addConversation,
    setActiveConversation,
    updateLastAssistantMessage,
    setStreaming,
    setStreamingPhase,
    updateCurrentPlan,
    setCurrentPlan,
    setContextUsage,
    addTask,
    setPendingInput,
    setClarifyQuestions,
    clearFiles,
    setInput,
    textareaRef,
    router,
  ]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, [setStreaming]);

  return {
    doSubmit,
    handleStop,
  };
}
