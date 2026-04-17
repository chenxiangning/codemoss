# Implementation Tasks: OpenCode Engine Isolation Hardening

## 1. 发送/中断路由隔离（P0）

- [x] 1.1 [P0][depends: none][<=2h]
  输入：`threadId + activeEngine + thread engineSource`  
  输出：统一 `resolveThreadEngine()` 判定函数（线程归属优先，activeEngine 兜底）  
  验证：单元测试覆盖三引擎 + 引擎切换后发送场景。

- [x] 1.2 [P0][depends: 1.1][<=2h]
  输入：当前 `interruptTurn` 分支逻辑  
  输出：中断路径改为按线程归属决策，不因 UI 当前引擎误路由  
  验证：Codex 线程切到 OpenCode 后中断仍调用 Codex 路径。

## 2. Pending 回填确定性（P0）

- [x] 2.1 [P0][depends: none][<=2h]
  输入：`onThreadSessionIdUpdated` 当前 `pending` 匹配策略  
  输出：双 pending 并存场景的确定性匹配规则（active pending > processing > turn bound > single）  
  验证：新增用例覆盖 claude/opencode 双 pending 回填。

- [x] 2.2 [P0][depends: 2.1][<=2h]
  输入：`renameThreadId` 后续事件补偿逻辑  
  输出：确保后续 delta/turn 事件不落空或重复迁移  
  验证：回归 `useThreadsReducer` 中 pending->session 合并测试。

## 3. 回归防线（P0）

- [x] 3.1 [P0][depends: 1.2,2.2][<=2h]
  输入：线程 hooks 变更  
  输出：前端测试新增/更新（至少 6 个跨引擎边界用例）  
  验证：`npx vitest run` 指定测试文件全通过。

- [x] 3.2 [P0][depends: 3.1][<=2h]
  输入：后端已存在 OpenCode/commands/status 逻辑  
  输出：引擎相关 Rust 测试回归  
  验证：`cargo test --manifest-path src-tauri/Cargo.toml engine::` 通过。

## 4. OpenSpec 收口（P0）

- [x] 4.1 [P0][depends: 3.2][<=1h]
  输入：实现与测试结果  
  输出：更新任务勾选与验证记录  
  验证：任务状态与实际执行一致。

- [x] 4.2 [P0][depends: 4.1][<=1h]
  输入：proposal/tasks/spec delta  
  输出：OpenSpec 校验通过  
  验证：`openspec validate --changes "2026-02-14-opencode-engine-isolation-hardening" --json` 返回 success。
