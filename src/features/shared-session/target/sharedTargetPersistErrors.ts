/**
 * Shared 发送目标落盘失败时的 toast 门禁。
 *
 * 设计意图：
 * - 用户主动改 Picker 且仍停在该会话时，真失败（磁盘权限等）才弹窗。
 * - 切 workspace / thread 后晚到的失败：用户已离开，弹窗只会懵圈 → 静默。
 * - meta.json 不存在（ENOENT）：常见于会话目录未就绪/已清理/竞态，
 *   文案又说「当前选择仍有效」，再弹 error 属于过度告警 → 静默。
 */

export function isMissingSharedSessionMetaError(error: unknown): boolean {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();
  return (
    message.includes("no such file or directory") ||
    message.includes("os error 2") ||
    message.includes("enoent") ||
    message.includes("the system cannot find the file") ||
    message.includes("the system cannot find the path") ||
    message.includes("系统找不到指定的文件") ||
    message.includes("系统找不到指定的路径")
  );
}

export function shouldSuppressSharedTargetPersistToast(
  error: unknown,
  context: {
    persistWorkspaceId: string;
    persistThreadId: string;
    activeWorkspaceId: string | null | undefined;
    activeThreadId: string | null | undefined;
  },
): boolean {
  if (
    context.activeWorkspaceId !== context.persistWorkspaceId ||
    context.activeThreadId !== context.persistThreadId
  ) {
    return true;
  }
  return isMissingSharedSessionMetaError(error);
}
