import type { QuickSwitcherNavigationId } from "@mossx/plugin-quick-switcher/runtime";
import { pushErrorToast } from "../../services/toasts";

/**
 * Quick Switcher「状态感知路由」的纯函数判定层（design.md D1 冻结口径）。
 *
 * 所有判定均为纯函数：不订阅、不读取 React state，只消费调用方传入的快照。
 * wrapper（useAppShellLayoutNodesSection）据此决定「未开 → open / 已开 → 回切」，
 * 并以 computeQuickSwitcherActiveNavigationIds 产出导航行 is-active 高亮集合。
 */
export type QuickSwitcherNavigationState = {
  activeTab: string;
  appMode: string;
  centerMode: string;
  filePanelMode: string;
  isCompact: boolean;
  isSearchPaletteOpen: boolean;
  rightPanelCollapsed: boolean;
  settingsOpen: boolean;
};

/**
 * 面板类入口（files/git/notes/memory）激活判定。
 * desktop：面板处于对应 mode 且右侧面板未收起。
 * compact：expand/collapse 是 no-op，以 activeTab === "git" + 面板 mode 判定。
 */
function isRightPanelEntryActive(
  state: QuickSwitcherNavigationState,
  mode: string,
): boolean {
  return state.isCompact
    ? state.activeTab === "git" && state.filePanelMode === mode
    : state.filePanelMode === mode && !state.rightPanelCollapsed;
}

export const isQuickSwitcherFilesActive = (
  state: QuickSwitcherNavigationState,
): boolean => isRightPanelEntryActive(state, "files");

export const isQuickSwitcherGitActive = (
  state: QuickSwitcherNavigationState,
): boolean => isRightPanelEntryActive(state, "git");

export const isQuickSwitcherNotesActive = (
  state: QuickSwitcherNavigationState,
): boolean => isRightPanelEntryActive(state, "notes");

export const isQuickSwitcherMemoryActive = (
  state: QuickSwitcherNavigationState,
): boolean => isRightPanelEntryActive(state, "memory");

export const isQuickSwitcherKanbanActive = (
  state: QuickSwitcherNavigationState,
): boolean => state.appMode === "kanban";

export const isQuickSwitcherHistoryActive = (
  state: QuickSwitcherNavigationState,
): boolean => state.appMode === "gitHistory";

export const isQuickSwitcherSettingsActive = (
  state: QuickSwitcherNavigationState,
): boolean => state.settingsOpen;

export const isQuickSwitcherGlobalSearchActive = (
  state: QuickSwitcherNavigationState,
): boolean => state.isSearchPaletteOpen;

export const isQuickSwitcherIntentCanvasActive = (
  state: QuickSwitcherNavigationState,
): boolean => state.centerMode === "intentCanvas";

export const isQuickSwitcherProjectMapActive = (
  state: QuickSwitcherNavigationState,
): boolean => state.centerMode === "projectMap";

/**
 * 当前已打开模块的导航 id 集合（D1 判定口径），顺序与组件 NAVIGATION_ITEMS
 * 一致；chat/spec/terminal 不参与（chat 无关闭语义、spec 为独立窗口、
 * terminal 的 toggle 判定不在 D1 表内）。
 */
export function computeQuickSwitcherActiveNavigationIds(
  state: QuickSwitcherNavigationState,
): QuickSwitcherNavigationId[] {
  const ids: QuickSwitcherNavigationId[] = [];
  if (isQuickSwitcherGlobalSearchActive(state)) {
    ids.push("globalSearch");
  }
  if (isQuickSwitcherFilesActive(state)) {
    ids.push("files");
  }
  if (isQuickSwitcherGitActive(state)) {
    ids.push("git");
  }
  if (isQuickSwitcherHistoryActive(state)) {
    ids.push("history");
  }
  if (isQuickSwitcherKanbanActive(state)) {
    ids.push("kanban");
  }
  if (isQuickSwitcherIntentCanvasActive(state)) {
    ids.push("intentCanvas");
  }
  if (isQuickSwitcherProjectMapActive(state)) {
    ids.push("projectMap");
  }
  if (isQuickSwitcherNotesActive(state)) {
    ids.push("notes");
  }
  if (isQuickSwitcherMemoryActive(state)) {
    ids.push("memory");
  }
  if (isQuickSwitcherSettingsActive(state)) {
    ids.push("settings");
  }
  return ids;
}

/**
 * 无效打开提示（D2）：无 active workspace 时以 info 级 toast 提示先选择工作区，
 * 代替静默打开空默认页（也代替 intentCanvas 旧有的 window.alert 路径）。
 */
export function pushQuickSwitcherSelectWorkspaceToast(
  t: (key: string) => string,
  target: QuickSwitcherNavigationId,
): void {
  pushErrorToast({
    variant: "info",
    title: t(`quickSwitcher.nav.${target}`),
    message: t("quickSwitcher.hints.selectWorkspaceFirst"),
  });
}
