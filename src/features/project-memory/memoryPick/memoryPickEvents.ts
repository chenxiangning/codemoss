import type { MemoryPickComposerMode } from "./memoryPickTypes";

/** 闸门内切换 always 时通知 Composer 同步菜单 */
export const MEMORY_PICK_COMPOSER_MODE_EVENT = "ccgui:memory-pick-composer-mode";

export type MemoryPickComposerModeEventDetail = {
  mode: MemoryPickComposerMode;
  workspaceId?: string;
  threadId?: string;
};

export function emitMemoryPickComposerMode(
  detail: MemoryPickComposerModeEventDetail,
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(MEMORY_PICK_COMPOSER_MODE_EVENT, { detail }),
  );
}
