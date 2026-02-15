// ─── Native Tools Registry ─────────────────────────────
// Core registry — no imports to tool modules (avoids circular deps).

export interface NativeToolContext {
  userId: string;
  conversationId: string | null;
  agentId: string | null;
  sessionUser: { name?: string | null; email?: string | null };
  planName?: string;
  planLimits?: {
    maxMessagesPerDay: number;
    maxAgents: number;
    maxStorageMb: number;
  };
}

export interface NativeToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    ctx: NativeToolContext
  ) => Promise<string>;
}

const registry = new Map<string, NativeToolDefinition>();

export function registerNativeTool(def: NativeToolDefinition) {
  registry.set(def.name, def);
}

export function isNativeTool(name: string): boolean {
  return registry.has(name);
}

export async function executeNativeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: NativeToolContext
): Promise<string> {
  const def = registry.get(name);
  if (!def) return `Error: unknown native tool "${name}"`;

  try {
    return await def.execute(args, ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[native-tool] ${name} failed:`, msg);
    return `Error executing ${name}: ${msg}`;
  }
}

export function getNativeToolDefinitions(): Array<{
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return Array.from(registry.values()).map((def) => ({
    type: "function" as const,
    function: {
      name: def.name,
      description: def.description,
      parameters: def.parameters,
    },
  }));
}
