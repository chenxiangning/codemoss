## Why

当前用户会在客户端外（其他工具或手工）修改 `Codex` 配置文件。客户端运行中不会主动重新读取这些外部变更，导致“文件已改但客户端仍用旧配置”，必须重启后才生效。

同时，用户在不同 source/provider 下产生的 `Codex` 会话历史在客户端内呈现为分离视图，默认只看到当前 source 的数据，无法获得“同一 workspace 的完整历史”。这会造成“历史像丢了”的感知。

这个问题的核心是两件事都缺失：
- 运行时配置重载入口（外部改配置后无刷新）
- 跨 source 历史聚合视图（历史默认按 source 分桶）

## 现状校准（2026-03-31，基于代码复核）

- `list_threads` 主链路直接调用 `thread/list`，返回结果受当前运行时 source 上下文影响。
- `vendor_switch_codex_provider` 仅更新 `~/.codemoss/config.json` 的 `codex.current`，未触发已运行 Codex session 重建。
- 进程启动时注入 `CODEX_HOME`，运行中缺少针对外部配置变更的 runtime reload 入口。
- 本地 fallback 能扫描 workspace 会话文件，但当前定位仍偏“兜底”，未形成“默认跨 source 全量历史视图”。

## 目标与边界

### 目标

- 目标 1：提供客户端内可触发的“Codex 配置刷新/重载”入口，无需重启应用。
- 目标 2：刷新成功后下一次 `Codex` 发送 MUST 使用最新配置文件。
- 目标 3：`Codex` 历史列表默认 MUST 展示同一 workspace 的跨 source 全量历史，而非仅当前 source。
- 目标 4：历史条目 MUST 保留 source 元信息用于识别，但默认视图不再按 source 隔离。

### 边界

- 本变更聚焦 `Codex`：外部配置变更 -> 手动刷新生效 + 历史聚合展示。
- 首期采用手动刷新，不强制引入自动文件监听。
- 不重构会话存储底层，仅在列表读取层做聚合与去重。

## 非目标

- 不在本轮重构 Claude / Gemini 配置链路。
- 不引入新的历史存储后端或数据库迁移。
- 不要求二期自动热更新（监听文件并自动刷新）。

## What Changes

- 新增“刷新 Codex 配置”触发入口（按钮或等效显式动作）。
- 刷新动作执行与启动期一致的最小初始化流程：重新读取配置文件并重建 Codex 运行上下文。
- 新增“跨 source 历史聚合”读取路径：统一汇总 workspace 下可见 `Codex` 历史条目，并默认全量展示。
- 历史条目增加 source/provider 标签字段（用于可视化区分与后续筛选）。
- 增加去重与排序规则，避免跨 source 聚合后重复/乱序。
- 增加回归测试：
  - 外部改配置 -> 客户端刷新 -> 无需重启生效
  - 跨 source 历史默认全量可见
  - 刷新前后历史连续性不回退

## 技术方案对比与取舍

| 方案 | 描述 | 优点 | 风险/成本 | 结论 |
|---|---|---|---|---|
| A. 维持现状（手工重启 + 当前 source 历史） | 外部改配置后重启，历史继续分桶显示 | 无开发成本 | 体验差、历史割裂 | 不采用 |
| B. 手动刷新 + 跨 source 聚合（首期） | 点击刷新后 runtime 生效；历史默认全量聚合 | 直接解决用户痛点、风险可控 | 需要补聚合与去重逻辑 | **首期采用** |
| C. 自动监听热更新 + 聚合 | 文件变更即自动刷新并聚合 | 操作最少 | 并发/抖动/半写入复杂度高 | 二期可选 |

取舍说明：首期采用方案 B，先把“无需重启即可生效 + 历史全量可见”落地；自动监听作为后续增强。

## Capabilities

### New Capabilities

- `codex-external-config-runtime-reload`: 定义外部配置变更后，客户端内手动刷新并即时生效的运行时契约。
- `codex-cross-source-history-unification`: 定义同一 workspace 下 Codex 历史跨 source 聚合、去重与可见性契约。

### Modified Capabilities

- `conversation-lifecycle-contract`: 扩展 Codex 刷新期间与刷新后的会话连续性约束，禁止出现“刷新后历史不可见/按 source 隔离导致缺失感”。

## 验收标准

- [ ] 外部修改 Codex 配置文件后，用户可在客户端内触发刷新，无需重启应用。
- [ ] 刷新成功后首条新消息 MUST 使用最新配置文件。
- [ ] 历史列表默认 MUST 展示同一 workspace 的跨 source 全量 Codex 历史。
- [ ] 每条历史记录 SHOULD 显示 source/provider 标签；默认不启用 source 隔离视图。
- [ ] 聚合后列表 MUST 满足确定性去重与按时间排序，不出现重复爆炸或错序闪动。
- [ ] 刷新成功或失败均不得导致历史整体清空；失败时旧上下文保持可用。
- [ ] `Claude` 与 `Gemini` 现有会话生命周期行为不回归。

## 兼容性测试更新（2026-03-31）

| 门禁项 | 执行命令 | 结果 | 备注 |
|---|---|---|---|
| Runtime contracts | `npm run check:runtime-contracts` | ✅ 通过 | `check-app-shell-runtime-contract`、`check-git-history-runtime-contract` 均 OK |
| TypeScript | `pnpm tsc --noEmit` | ✅ 通过 | 无类型错误 |
| Lint | `npm run lint` | ✅ 通过 | 0 error，116 warning（存量 `react-hooks/exhaustive-deps`） |
| Build | `npm run build` | ✅ 通过 | 前端产物构建成功 |
| Frontend tests | `npm run test` | ✅ 通过 | batched vitest 232/232 文件通过 |
| Rust tests | `cargo test --manifest-path src-tauri/Cargo.toml` | ✅ 通过 | lib 287 tests + integration 1 test 通过 |

结论：自动化兼容性门禁已全部通过；关键手测清单待在客户端 UI 环境补录。

## 关键手测清单（已补，待执行）

- 手测清单已补录：`openspec/changes/fix-codex-source-switch-runtime-apply-2026-03-31/manual-verification.md`
- 覆盖范围：外部配置刷新生效、跨 source 历史聚合、去重排序稳定性、刷新失败回退、Claude/Gemini 非回归。
- 当前状态：待在客户端 UI 环境逐项执行并回填结果。

## Impact

- 规范影响：
  - 新增 `openspec/specs/codex-external-config-runtime-reload/spec.md`
  - 新增 `openspec/specs/codex-cross-source-history-unification/spec.md`
  - 修改 `openspec/specs/conversation-lifecycle-contract/spec.md`
- 代码影响（预期）：
  - `src-tauri/src/codex/mod.rs`（thread list 聚合入口）
  - `src-tauri/src/local_usage.rs`（跨 source 会话汇总与元信息）
  - `src-tauri/src/vendors/commands.rs`（刷新触发后与 session 重建衔接）
  - `src-tauri/src/shared/workspaces_core.rs`（重建会话复用）
  - `src/features/settings/components/settings-view/sections/CodexSection.tsx`（刷新入口与反馈）
  - 对应前后端回归测试文件
- API 影响：新增内部刷新命令/增强列表语义；不新增外部公开协议。
- 依赖影响：无新增第三方依赖。
