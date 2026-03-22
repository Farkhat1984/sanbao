"use client";

import { memo } from "react";
import { User, Search, Globe, DatabaseZap, Calculator, Bookmark, ClipboardList, Bell, StickyNote, BarChart3, Send, Plug } from "lucide-react";
import { motion } from "framer-motion";
import { SanbaoCompass } from "@/components/ui/SanbaoCompass";
import { cn } from "@/lib/utils";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";
import type { ToolCategory } from "@/lib/chat/tool-categories";

/** Map tool category → animated icon during streaming */
const STREAMING_ICONS: Record<string, typeof Search> = {
  web_search: Globe,
  knowledge: DatabaseZap,
  calculation: Calculator,
  memory: Bookmark,
  task: ClipboardList,
  notification: Bell,
  scratchpad: StickyNote,
  chart: BarChart3,
  http: Send,
  mcp: Plug,
  generic: Search,
};

interface MessageAvatarProps {
  isUser: boolean;
  agentIcon?: string;
  agentIconColor?: string;
  /** Active streaming tool category — morphs avatar icon when set */
  streamingCategory?: ToolCategory | null;
}

/** Renders the circular avatar for user or assistant messages.
 *  During streaming, the icon morphs to reflect the current tool state.
 */
export const MessageAvatar = memo(function MessageAvatar({ isUser, agentIcon, agentIconColor, streamingCategory }: MessageAvatarProps) {
  const hasCustomIcon = agentIcon && ICON_MAP[agentIcon];
  const AgentIcon = hasCustomIcon ? ICON_MAP[agentIcon] : null;
  const isStreaming = !!streamingCategory;

  // Pick the streaming icon (Search as default for "generic" / initial state)
  const StreamIcon = isStreaming
    ? (STREAMING_ICONS[streamingCategory!] || Search)
    : null;

  // Animation per category
  const anim = isStreaming
    ? streamingCategory === "web_search"
      ? { rotateY: [0, 360] }         // spinning globe
      : streamingCategory === "knowledge" || streamingCategory === "mcp"
        ? { scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }  // pulsing database
        : streamingCategory === "calculation"
          ? { rotateZ: [0, -10, 10, -5, 5, 0] }
          : streamingCategory === "generic"
            ? { rotateZ: [0, 15, -15, 10, -10, 0] }  // searching wiggle
            : { scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }  // default pulse
    : null;

  const animDuration = streamingCategory === "web_search" ? 2
    : streamingCategory === "knowledge" ? 1.2
    : 1.5;

  // Render the appropriate icon
  const renderIcon = () => {
    if (StreamIcon) {
      return (
        <motion.div
          key={streamingCategory}
          initial={{ scale: 0.9, opacity: 0.5 }}
          animate={{
            scale: 1,
            opacity: 1,
            ...anim,
          }}
          transition={{
            scale: { duration: animDuration, repeat: Infinity, ease: "easeInOut" },
            opacity: { duration: animDuration, repeat: Infinity, ease: "easeInOut" },
            rotateY: anim?.rotateY ? { duration: animDuration, repeat: Infinity, ease: "linear" } : undefined,
            rotateZ: anim?.rotateZ ? { duration: animDuration, repeat: Infinity, ease: "easeInOut" } : undefined,
          }}
        >
          <StreamIcon className="h-4 w-4" />
        </motion.div>
      );
    }
    if (AgentIcon) return <AgentIcon className="h-4 w-4" />;
    return <SanbaoCompass size={18} className="text-white" />;
  };

  return (
    <div
      className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 relative",
        isUser
          ? "bg-accent text-white"
          : !agentIconColor && "bg-accent text-white"
      )}
      style={!isUser && agentIconColor ? { backgroundColor: agentIconColor, color: "white" } : undefined}
    >
      {isUser ? <User className="h-4 w-4" /> : renderIcon()}
    </div>
  );
});
