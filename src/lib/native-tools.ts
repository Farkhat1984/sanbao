// ─── Native Tools Entry Point (shim) ────────────────────
// Delegates to native-tools/index.ts which handles all tool registration.
// This file exists for backward compatibility — all imports of "@/lib/native-tools" resolve here.

export {
  registerNativeTool,
  isNativeTool,
  executeNativeTool,
  getNativeToolDefinitions,
  type NativeToolContext,
  type NativeToolDefinition,
} from "./native-tools/index";
