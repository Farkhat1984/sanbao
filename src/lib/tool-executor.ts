/**
 * Tool Executor — executes WEBHOOK, URL, and FUNCTION type tools.
 * PROMPT_TEMPLATE tools are handled purely on the frontend.
 */

const TOOL_TIMEOUT_MS = 30_000;
const RESPONSE_CAP = 10 * 1024; // 10KB

/** Interpolate {{key}} placeholders in a string */
function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined ? String(val) : "";
  });
}

export interface ToolExecutionResult {
  success: boolean;
  result?: string;
  error?: string;
}

export async function executeWebhookTool(
  config: { url: string; method?: string; headers?: Record<string, string>; bodyTemplate?: string },
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const url = interpolate(config.url, input);
    const method = (config.method || "POST").toUpperCase();
    const headers: Record<string, string> = { "Content-Type": "application/json", ...config.headers };

    let body: string | undefined;
    if (method !== "GET" && method !== "HEAD") {
      body = config.bodyTemplate
        ? interpolate(config.bodyTemplate, input)
        : JSON.stringify(input);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TOOL_TIMEOUT_MS);

    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const text = await response.text();
    const truncated = text.length > RESPONSE_CAP ? text.slice(0, RESPONSE_CAP) + "...[truncated]" : text;

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${truncated}` };
    }

    return { success: true, result: truncated };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function executeUrlTool(
  config: { url: string; method?: string; headers?: Record<string, string> },
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const url = interpolate(config.url, input);
    const method = (config.method || "GET").toUpperCase();
    const headers: Record<string, string> = { ...config.headers };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TOOL_TIMEOUT_MS);

    const response = await fetch(url, {
      method,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const text = await response.text();
    const truncated = text.length > RESPONSE_CAP ? text.slice(0, RESPONSE_CAP) + "...[truncated]" : text;

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${truncated}` };
    }

    return { success: true, result: truncated };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// Internal function registry — extend as needed
type InternalFunction = (input: Record<string, unknown>) => Promise<ToolExecutionResult>;

const FUNCTION_REGISTRY: Record<string, InternalFunction> = {
  // Example: "echo" function
  echo: async (input) => ({
    success: true,
    result: JSON.stringify(input),
  }),
};

export async function executeFunctionTool(
  config: { functionName: string },
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const fn = FUNCTION_REGISTRY[config.functionName];
  if (!fn) {
    return { success: false, error: `Unknown function: ${config.functionName}` };
  }
  return fn(input);
}

/** Register a custom internal function */
export function registerFunction(name: string, fn: InternalFunction) {
  FUNCTION_REGISTRY[name] = fn;
}
