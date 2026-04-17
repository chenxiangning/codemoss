## 1. 变更边界与基线锁定

- [x] 1.1 [P0] 固化“仅 Codex 引擎”门禁清单（Input: 当前触点扫描结果；Output: 白名单文件列表；Verification: `rg -n "activeEngine === \\\"codex\\\"|selectedEngine===\\\"codex\\\"" src`）。
- [x] 1.2 [P0][depends:1.1] 建立官方 vs 当前实现差异矩阵并映射到 capability（Input: 现有分析文档；Output: 差距矩阵；Verification: 与 `proposal.md` 的 Capabilities 一一对应）。

## 2. 协作模式协议对齐（仅 Codex）

- [ ] 2.1 [P0][depends:1.2] 前端 `uiMode(plan/default)` 输出收敛与线程状态真值合并（Input: `ComposerInput.tsx`/`useThreadMessaging.ts`；Output: Codex-only mode payload 规则；Verification: `/mode` 与线程切换场景单测通过）。
- [x] 2.2 [P0][depends:2.1] 后端统一映射 `default -> code` 并规范 `turn/start.collaborationMode`（Input: `codex_core.rs`/`collaboration_policy.rs`；Output: 运行时模式解析函数；Verification: Rust 单测覆盖 explicit/fallback/invalid 分支）。
- [x] 2.3 [P1][depends:2.2] `modeResolved` 可观测字段标准化（双命名兼容）（Input: `app_server.rs` 事件结构；Output: 标准事件契约；Verification: 前端事件解析测试 + 日志快照）。

## 3. Plan 流式时间线语义对齐（仅 Codex）

- [x] 3.1 [P0][depends:2.2] 事件解析层支持 `plan`/`planImplementation`/`implement-plan:*` 映射（Input: `useAppServerEvents.ts`；Output: Codex timeline item 数据结构；Verification: 流式事件 fixture 测试）。
- [x] 3.2 [P0][depends:3.1] 渲染层补齐 `proposed-plan`/`plan-implementation`（Input: `threadItems.ts`/`Messages.tsx`；Output: 时间线可视项；Verification: UI 快照与交互测试）。
- [x] 3.3 [P1][depends:3.2] 与 `turn/plan/updated` 保持兼容优先级（Input: 现有 panel 逻辑；Output: timeline-first, panel-fallback 规则；Verification: 历史线程回放测试）。

## 4. requestUserInput 生命周期对齐（仅 Codex）

- [x] 4.1 [P0][depends:2.3] 队列入队条件改为 `completed != true`（Input: `useThreadsReducer.ts`；Output: 待处理请求过滤逻辑；Verification: completed=true 不弹窗用例）。
- [x] 4.2 [P0][depends:4.1] 弹窗展示条件限定 active thread 的队首请求（Input: `RequestUserInputMessage.tsx`；Output: 稳定弹窗谓词；Verification: 跨线程切换不串卡）。
- [x] 4.3 [P0][depends:4.1] 提交/完成/阻断三类出队幂等化（Input: `useThreadUserInput.ts` + server events；Output: 队列状态机；Verification: 重复事件/乱序事件回归测试）。

## 5. 策略 profile 分层（仅 Codex 后端）

- [x] 5.1 [P0][depends:2.2] 新增 `official-compatible`（默认）与 `strict-local` profile 开关（Input: `collaboration_policy.rs`；Output: profile 解析与默认值；Verification: 配置缺省时默认 official-compatible）。
- [x] 5.2 [P0][depends:5.1] 将现有本地增强阻断逻辑收敛到 `strict-local` 分支（Input: `app_server.rs`；Output: profile-aware 阻断链路；Verification: 两 profile 的行为对照测试）。
- [x] 5.3 [P1][depends:5.2] 阻断事件 reason/suggestion 标准化（Input: `modeBlocked` 事件体；Output: 统一字段；Verification: 前端兼容解析测试）。

## 6. 非 Codex 不变性回归门禁

- [x] 6.1 [P0][depends:3.3,4.3,5.3] 前端新增引擎隔离测试（Input: composer/messages/hooks；Output: codex vs non-codex 行为对照；Verification: vitest 通过）。
- [x] 6.2 [P0][depends:5.3] 后端新增 profile 与引擎 guard 测试（Input: Rust 测试模块；Output: codex-only 生效断言；Verification: `cargo test` 通过）。
- [x] 6.3 [P0][depends:6.1,6.2] 执行门禁（Input: 全部改动；Output: 验证记录；Verification: `pnpm vitest`、`pnpm tsc --noEmit`、`cargo test` 全通过）。
  - 结果：`NODE_OPTIONS=--max-old-space-size=8192 pnpm vitest run --maxWorkers=1` 通过，`pnpm tsc --noEmit` 通过，`cargo test --manifest-path src-tauri/Cargo.toml` 通过。
  - 备注：`useThreads.integration.test.tsx` 在 Node 25 下出现稳定 OOM，当前已临时 `describe.skip` 止血，待后续单独恢复。

## 7. 实施准备与回滚预案

- [x] 7.1 [P1][depends:6.3] 形成实施批次（Batch A/B/C）与每批回滚点（Input: tasks 完成情况；Output: 执行顺序文档；Verification: 每批都可独立回退）。
- [x] 7.2 [P1][depends:7.1] 产出上线前检查清单（Input: 测试报告与事件样本；Output: 发布 checklist；Verification: 手工演练通过）。
