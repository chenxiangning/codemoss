# Proposal: plugin-manifest-v1-parser

> OpenSpec change id: `plugin-manifest-v1-parser`
> Wave：0B（插排图纸 · Contract parser）
> 架构：[`docs/architecture/plugin-platform/14-v1-contract-freeze.md`](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)
> 依赖：无产品依赖；字段以 `14` 为准。可与 `plugin-kernel-ownership-inventory` 并行。

## Why

插座还没长成代码。Host / Broker / Pilot 若先写，会各自发明一份 Manifest 默认值。`14` 已经冻结字段、Catalog、event、DAG 与 fail-closed 规则，第一块可测代码必须是 **不执行插件、不接生产路径** 的 parser + validator。

## 目标与边界

1. 按 `14` 实现 Manifest V1 Closed Schema 与 parser（identity、三轴 version、entries、activationUnits、contributions、templates、capabilities、storage、budgets）。
2. 未知字段、未知 kind/event/capability、越界 template、跨插件 private capability、`onStartup` 非白名单、平台缺失、DAG cycle，全部 fail closed。
3. 安装前审计路径禁止加载 Worker/Process/UI/Migration 入口。
4. 生成 Rust + TypeScript 类型的单一 schema 源。
5. 不接入 AppShell、不启动 Host、不改变现有产品行为。

## 非目标

- Extension Host / QuickJS / Process supervisor
- IPC framing（另开 `plugin-ipc-v1-framing`）
- Storage checkpoint runner
- Marketplace / 签名验证完整实现（本 change 只预留 integrity 字段解析）
- 把 Claude / Notes 迁出 Core

## 技术方案对比

| 方案 | 做法 | 取舍 |
|---|---|---|
| A. 先写 Host 再补 schema | 边做边定字段 | 与 `14` 漂移，SDK 三份手写类型 |
| B. 手写 Rust/TS 类型各一份 | 快 | 必漂 |
| **C. JSON Schema 单源 + 双端 validator + fixtures（采用）** | `packages/plugin-contract` | 慢半步，但 P0 验收可独立关闭 |

## Capabilities

### New Capabilities

- `plugin-manifest-v1`：Closed Manifest 解析、三轴 version、Reverse-DNS pluginId
- `plugin-entry-dag-v1`：discriminated entries、Physical DAG、Activation Unit
- `plugin-capability-catalog-v1`：`mossx.*` Catalog、private namespace、template envelope

## Impact

- 新增 `packages/plugin-contract/`（schema + fixtures）
- 新增 Rust crate 或 `src-tauri/src/plugin_runtime/manifest.rs`（仅 parser，不注册 command）
- 新增 TS 包或 `src/plugin-kernel/manifest.ts`（仅类型与纯函数）
- 测试：合法 Notes 样例通过；`14` 列出的拒绝用例全部失败
- 不改 `command_registry.rs` 生产命令

## 验收标准

1. `14` §18 的 Notes 最小样例解析成功。
2. 未知 top-level 字段、未知 event、未知 kind、DAG cycle、悬空 entryId、`trusted-react` + non-system、无上界 `coreApi`、`onStartup` 非白名单，全部拒绝。
3. parser 测试不 `fs.read` 插件 `path` 指向的 JS/可执行文件（no-code-execution gate）。
4. 同一 `pluginId + version` 不同 hash 的 fixture 被拒绝。
5. `openspec validate plugin-manifest-v1-parser --strict --no-interactive` 通过。
6. 现有产品测试不被本 change 染红。
