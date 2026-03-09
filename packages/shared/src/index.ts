/**
 * @sanbao/shared — types, constants, i18n, and utilities shared across apps and packages.
 *
 * Prefer subpath imports for tree-shaking:
 *   import { cn } from "@sanbao/shared/utils"
 *   import { t } from "@sanbao/shared/i18n"
 *   import { APP_NAME } from "@sanbao/shared/constants"
 *
 * This barrel re-exports everything for convenience, but subpath imports
 * are recommended for production code.
 */

export * from "./constants";
export * from "./utils";
export * from "./i18n";
export * from "./validation";
export * from "./bounded-map";
export * from "./parse-message-content";
export * from "./csv-utils";
export * from "./types/index";
export * from "./chat/tool-categories";
