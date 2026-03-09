/**
 * Reset all Zustand stores on logout to prevent data leaks between sessions.
 */
import { useChatStore } from "./chatStore";
import { useArtifactStore } from "./artifactStore";
import { useAgentStore } from "./agentStore";
import { useTaskStore } from "./taskStore";
import { useMemoryStore } from "./memoryStore";
import { useBillingStore } from "./billingStore";
import { useSkillStore } from "./skillStore";
import { usePanelStore } from "./panelStore";
import { useSidebarStore } from "./sidebarStore";
import { useArticleStore } from "./articleStore";
import { useOrgStore } from "./orgStore";
import { useSourceStore } from "./sourceStore";
import { useIntegrationStore } from "./integrationStore";
import { useOnboardingStore } from "./onboardingStore";

export function resetAllStores() {
  useChatStore.setState({
    activeConversationId: null,
    activeAgentId: null,
    conversations: [],
    messages: [],
    isStreaming: false,
    streamingPhase: null,
    streamingToolName: null,
    streamingContent: null,
    streamingReasoning: null,
    streamingPlanContent: null,
    currentPlan: null,
    contextUsage: null,
    pendingInput: null,
    clarifyQuestions: null,
  });

  useArtifactStore.setState({
    activeArtifact: null,
    activeTab: "preview",
    artifacts: [],
  });

  useAgentStore.setState({
    agents: [],
    activeAgent: null,
    agentTools: [],
    isLoading: false,
  });

  useTaskStore.setState({
    tasks: [],
    isTaskPanelOpen: false,
    isLoading: false,
  });

  useMemoryStore.setState({
    memories: [],
    isLoading: false,
  });

  useBillingStore.setState({
    plan: null,
    usage: null,
    monthlyUsage: null,
    plans: [],
    isLoading: false,
  });

  useSkillStore.setState({
    skills: [],
    activeSkillId: null,
    isLoading: false,
  });

  usePanelStore.setState({
    isOpen: false,
    tabs: [],
    activeTabId: null,
  });

  useSidebarStore.setState({
    searchQuery: "",
  });

  useArticleStore.setState({
    activeArticle: null,
    loading: false,
    error: null,
    cache: new Map(),
  });

  useOrgStore.setState({
    organizations: [],
    activeOrg: null,
    members: [],
    agents: [],
    isLoading: false,
  });

  useSourceStore.setState({
    activeSource: null,
    loading: false,
    error: null,
    cache: new Map(),
  });

  useIntegrationStore.setState({
    integrations: [],
    isLoading: false,
  });

  useOnboardingStore.setState({
    hasSeenTour: false,
    _hydrated: false,
    currentStep: null,
  });
}
