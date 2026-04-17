# 联调与门禁记录（2026-02-18）

## 1. 跨引擎联调清单（4.1）

| 检查项                              | Claude                        | Codex                  | OpenCode                                       | 结果 | 证据                                                                                                            |
|----------------------------------|-------------------------------|------------------------|------------------------------------------------|----|---------------------------------------------------------------------------------------------------------------|
| 删除结果以后端确认为准                      | `delete_claude_session` 成功才移除 | `archive_thread` 成功才移除 | 当前无 hard-delete 后端，返回 `ENGINE_UNSUPPORTED` 并保留 | 通过 | `src/features/threads/hooks/useThreadActions.ts`、`src/features/threads/hooks/useThreads.ts`                   |
| 删除后 reload 一致性                   | 删除后再次拉取列表不回魂                  | 依赖后端列表结果，前端无乐观保留       | 失败路径保留会话，不伪成功                                  | 通过 | `src/features/threads/hooks/useThreadActions.test.tsx` 中 `keeps deleted claude sessions absent after reload`  |
| Workspace Home 与 Composer 引擎可选一致 | 可选                            | 可选                     | 安装时可选，未安装时禁用                                   | 通过 | `src/features/engine/utils/engineAvailability.ts`、`src/features/workspaces/components/WorkspaceHome.test.tsx` |
| OpenCode 最近会话排序基线稳定              | N/A                           | N/A                    | 优先 `updatedAt`，失败安全回退并记录日志                     | 通过 | `src-tauri/src/engine/commands.rs`（parse + warn）                                                              |
| Plan/等待提示 i18n 一致                | 统一 key                        | 统一 key                 | 统一 key + heartbeat fallback                    | 通过 | `src/i18n/locales/canvasCopy.snapshot.test.ts`                                                                |

## 2. 质量门禁报告（4.2）

### 2.1 命令与结果

1. `npm run -s typecheck`  
   结果：通过。

2. `cargo test parse_opencode_ --manifest-path src-tauri/Cargo.toml`  
   结果：通过（9 passed, 0 failed）。

3.
`npm run -s test:watch -- src/features/threads/hooks/useThreadActions.test.tsx src/features/workspaces/components/WorkspaceHome.test.tsx src/features/plan/components/PlanPanel.test.tsx src/features/messages/components/Messages.test.tsx src/i18n/locales/canvasCopy.snapshot.test.ts --run`  
结果：通过（55 passed, 0 failed）。

4.
`npm run -s test:watch -- src/features/threads/hooks/useThreads.integration.test.tsx -t "returns ENGINE_UNSUPPORTED" --run`  
结果：通过（目标回归用例 passed）。

### 2.2 已知限制

- `npm run -s test:watch -- src/features/threads/hooks/useThreads.integration.test.tsx --run` 在当前机器触发 Node OOM（
  `heap out of memory`）。  
  已通过目标用例运行保证本次改动路径，并保留后续将该重测拆分/降内存占用的改进项。

## 3. 回滚与降级演练（4.3）

### 3.1 风险点

1. 删除语义收敛后，OpenCode 用户会看到明确失败（`ENGINE_UNSUPPORTED`），不再出现“假删除”。
2. Workspace Home 与 Composer 共享引擎可用性判定，若 helper 逻辑出错会影响入口可选状态。
3. OpenCode 时间解析逻辑新增，若遇到未覆盖格式可能触发日志增多。

### 3.2 单发布窗口回滚步骤（桌面演练）

1. 回滚删除适配层到上一版本（撤销 `deleteThreadForWorkspace` 新分支逻辑），优先恢复可用性。
2. 回滚引擎可用性共享 helper（`engineAvailability.ts`）并恢复原页面判定。
3. 回滚 OpenCode `updatedAt` 解析字段，恢复旧排序回退逻辑。
4. 重新执行最小门禁：`typecheck` + `useThreadActions` + `WorkspaceHome` + `Messages`。
5. 发布降级说明：OpenCode 删除临时退回不可用提示，排序恢复旧策略。

### 3.3 演练结论

- 回滚路径可在单发布窗口内完成，且每一步都有可独立验证的最小测试集。
