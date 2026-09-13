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
export async function addPluginWorkspace(pluginId: string, path: string, meta?: Record<string, unknown>): Promise<void> {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new Error(`[plugins] "${pluginId}" workspaces.add: empty path`);
  }
  await useChatStore.getState().addWorkspace(trimmed, meta);
}
