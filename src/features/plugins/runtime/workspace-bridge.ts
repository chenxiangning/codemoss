import { ipc } from "@/lib/ipc";
import { useChatStore } from "@/features/chat/store";

/**
 * ctx.workspaces.add 的宿主实现：把任意路径登记为侧栏工作区（可选携带
 * 透传 meta，如 { wsl: { hostId, distro } }）。独立成模块而不是内联进
 * context.ts：chat store 依赖链重（ipc/events），让 runtime/context 的
 * 单元测试可以只 mock 本模块（composer-draft 同款理由）。
 *
 * 与侧栏「添加工作区」的差异：不要求本机存在该目录（远程机/WSL 发行版
 * 内路径），meta 存在时由后端放行 is_dir 校验并随行存储。
 */
export async function addPluginWorkspace(
  pluginId: string,
  path: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new Error(`[plugins] "${pluginId}" workspaces.add: empty path`);
  }
  // 直连 ipc 而非 store action:store 把失败写进 actionError 静默返回,
  // 插件需要真实的成功/失败信号来决定 UI(标记已登记 / 报错)。
  await ipc.addWorkspace(trimmed, meta);
  await useChatStore.getState().refreshWorkspaces();
}

/** ctx.sessions.selectSession 的宿主实现：按引擎 + 会话 id 打开（或恢复）
 *  一个既有会话。会话必须已存在于宿主会话表（远程来源的登记由插件侧扩展）；
 *  未知的 engine/sessionId 组合抛错，不静默。 */
export function openPluginSession(
  pluginId: string,
  engine: string,
  sessionId: string,
  workspacePath: string,
): void {
  const store = useChatStore.getState();
  const known = store.sessions.some(
    (s) => s.engine === engine && s.sessionId === sessionId && s.workspacePath === workspacePath,
  );
  // 远程来源(如 WSL 发行版)的会话宿主扫描不到,但工作区已登记 → 放行:
  // 打开后走 --resume,历史回放失败由 store 既有 error 分支呈现。
  const workspaceRegistered = store.workspaces.some((w) => w.path === workspacePath);
  if (!known && !workspaceRegistered) {
    throw new Error(
      `[plugins] "${pluginId}" sessions.selectSession: unknown session ${engine}/${sessionId}`,
    );
  }
  store.selectSession(engine, sessionId, workspacePath);
}
