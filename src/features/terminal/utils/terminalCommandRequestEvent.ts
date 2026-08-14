/**
 * 跨 surface「在内嵌终端执行命令」请求事件。
 * OpenSpec: openspec/changes/add-pi-provider-auth（首个消费者：PI 供应商 OAuth 登录引导）
 *
 * 事件驱动（Render Perf Baseline：不新增 shell state / 不挂根 hook 链）：
 * 任一层级的 UI 都可以通过该事件请求 AppShell 在工作区内嵌终端里执行命令，
 * 由 useAppShellWorkspaceFlowsSection 统一消费（复用 Claude TUI resume 同款
 * ensure → open → restart → ready-write 链路）。
 *
 * followUpCommand：TUI 类命令的两段式输入（先启动 `pi`，延迟后再输入 `/login x`）——
 * slash 命令作为 argv 会被当作 prompt 发给模型，必须走 PTY 输入缓冲。
 */
export interface TerminalCommandRequest {
  /** 终端 tab 稳定 id（同 id 复用 tab 并 restart） */
  terminalId: string;
  /** 终端 tab 标题 */
  title: string;
  /** 首条写入 shell 的命令（会自动补 \n） */
  command: string;
  /** 可选：首条命令启动的 TUI 就绪后写入的第二段输入 */
  followUpCommand?: string;
  /** followUpCommand 的延迟毫秒数，默认 1500 */
  followUpDelayMs?: number;
}

export const TERMINAL_COMMAND_REQUEST_EVENT = "mossx:terminal-command-request";

export function requestTerminalCommand(detail: TerminalCommandRequest): void {
  document.dispatchEvent(
    new CustomEvent<TerminalCommandRequest>(TERMINAL_COMMAND_REQUEST_EVENT, {
      detail,
    }),
  );
}
