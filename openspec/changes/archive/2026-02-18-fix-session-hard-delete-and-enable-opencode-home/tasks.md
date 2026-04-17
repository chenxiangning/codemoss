# Implementation Tasks: Fix Session Hard Delete And Enable OpenCode Home Entry

## 1. 删除契约收敛（后端确认优先）

- [x] 1.1 将 `useThreadActions.archiveThread` 从吞错改为抛错，保证调用方能感知失败。
- [x] 1.2 将 `useThreadActions.archiveClaudeThread` 在 workspace 未连接时显式失败（`workspace not connected`）。
- [x] 1.3 在 `useThreads.removeThread` 引入结构化删除结果（`success/code/message`）。
- [x] 1.4 将线程删除改为“后端成功后再本地移除”，失败时保持会话可见。
- [x] 1.5 建立错误码映射（`WORKSPACE_NOT_CONNECTED` / `SESSION_NOT_FOUND` / `PERMISSION_DENIED` / `IO_ERROR` /
  `ENGINE_UNSUPPORTED` / `UNKNOWN`）。

## 2. Workspace Home 批量删除一致性

- [x] 2.1 将 `WorkspaceHome.onDeleteConversations` 回调签名升级为结构化回执。
- [x] 2.2 批量删除后仅在全成功时退出管理态并清空选择。
- [x] 2.3 部分失败时仅保留失败项为选中态，支持用户二次操作。
- [x] 2.4 在 `App.tsx` 聚合失败摘要并显示错误分类。

## 3. 单条删除路径一致性

- [x] 3.1 归档快捷键路径（`handleArchiveActiveThread`）改为等待删除结果并处理失败。
- [x] 3.2 Sidebar 单条删除路径改为等待删除结果并处理失败。

## 4. OpenCode 首页入口对齐

- [x] 4.1 将 Workspace Home 引擎下拉中的 OpenCode 从禁用态改为可选态。
- [x] 4.2 保持“新建会话”沿用现有 `startThreadForWorkspace(..., engine: "opencode")` 启动链路。

## 5. 国际化与测试

- [x] 5.1 新增删除失败文案和错误码映射（`en.ts` / `zh.ts`）。
- [x] 5.2 更新 `WorkspaceHome` 测试以适配新删除回执签名。
- [x] 5.3 增加“部分成功保留失败项选中”的组件测试。
- [x] 5.4 更新 `useThreadActions` 测试以验证 archive 失败可抛出。
- [x] 5.5 执行最小验证：`npm run typecheck` 与目标测试文件通过。

## 6. 待补验证（后续可选）

- [ ] 6.1 增加“重启后已删除会话不复活”的端到端回归测试。
- [ ] 6.2 增加 OpenCode 入口可用性（下拉可选 + 新建成功）的集成测试。
