# project-runtime-log-viewer 回归检查清单

## FileTree 旧行为基线（必须保持）

- [x] 文件树搜索输入可正常筛选文件与文件夹。
- [x] 点击文件行仅触发打开文件，不触发 Run。
- [x] 点击文件夹行仅触发展开/折叠，不触发 Run。
- [ ] 文件预览（文本/图片）入口行为与改动前一致。
- [ ] 复制路径、在 Finder 中显示、删除/新建文件等右键能力保持可用。

## Run 入口隔离验证

- [x] 点击 Run icon 仅触发运行，不触发 `onOpenFile`。
- [x] Run icon 可在无活动工作区场景下被禁用或安全忽略，不报错。
- [x] Run 启动后右侧文件树列表可继续滚动与选择，不被阻塞。

## Runtime Console 验收

- [ ] 点击 Run 后 2 秒内进入 starting/running 状态。
- [ ] 日志实时追加，支持 Stop/Clear/Copy/Hide/Auto-scroll。
- [ ] 退出时显示 Exit code；失败时显示失败原因。
- [ ] 日志超出上限时展示“截断提示”，界面仍然流畅。

## 工作区隔离

- [ ] A 工作区运行日志不串到 B 工作区。
- [ ] 切回 A 工作区时可看到 A 的运行会话状态。

## 质量门禁

- [x] `pnpm vitest run src/features/app/hooks/useWorkspaceRuntimeRun.test.tsx`
- [x] `pnpm vitest run src/features/app/hooks/useWorkspaceLaunchScript.test.tsx src/features/app/hooks/useWorkspaceLaunchScripts.test.tsx`
- [x] `pnpm typecheck`
- [x] `cd src-tauri && cargo check`
- [x] `cd src-tauri && cargo test runtime_log:: -- --nocapture`

## 自动化执行记录（2026-03-03）

- [x] `pnpm vitest run src/features/files/components/FileTreePanel.run.test.tsx`（新增用例：Run click 不触发 `onOpenFile`；无 handler 时按钮禁用）
- [x] `pnpm vitest run src/features/app/hooks/useWorkspaceRuntimeRun.test.tsx src/features/files/components/FileTreePanel.run.test.tsx src/features/app/hooks/useWorkspaceLaunchScript.test.tsx src/features/app/hooks/useWorkspaceLaunchScripts.test.tsx`（14 tests passed）
- [x] `pnpm typecheck`（`tsc --noEmit` passed）
- [x] `cd src-tauri && cargo check && cargo test runtime_log:: -- --nocapture`（runtime_log 4 tests passed）

## 自动化执行记录（2026-03-04）

- [x] `pnpm vitest run src/features/files/components/FileTreePanel.run.test.tsx`（6 tests passed；覆盖搜索、Run 触发隔离、文件夹展开与 Windows 路径 mention）
- [x] `pnpm vitest run src/features/app/hooks/useWorkspaceRuntimeRun.test.tsx src/features/files/components/FileTreePanel.run.test.tsx src/features/app/hooks/useWorkspaceLaunchScript.test.tsx src/features/app/hooks/useWorkspaceLaunchScripts.test.tsx`（21 tests passed）
- [x] `pnpm tsc --noEmit`
- [x] `cd src-tauri && cargo check`
- [x] `cd src-tauri && cargo test runtime_log:: -- --nocapture`（8 tests passed）
