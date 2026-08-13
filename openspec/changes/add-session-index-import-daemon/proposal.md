# Proposal: add-session-index-import-daemon

> 补全能力：外部 CLI 会话定时导入 Session Index。侧栏加载不扫盘。

## Why

侧栏只读 SQLite。客户端创建已 upsert。外部 `claude`/`codex` 等 CLI 开的会话不会自动进库，重启就看不见。导入必须离开 first-paint，否则又慢又盖列表。

## 目标与边界

1. App 进程内后台循环：间隔导入已登记工作区的外部 CLI 会话到 `session-index.sqlite3`。
2. 复用现有有界 writers（fingerprint skip、Codex recent-first、limit）。
3. 去重：主键 `(engine, session_id)`；幂等 upsert；tombstone 不复活。
4. 导入成功且有新增/更新时，发事件让侧栏再 `SELECT`，不跑磁盘 list。

## 非目标

- 不改侧栏 first-paint（仍只读 SQLite）
- 不扫 exhaustive catalog / 全树 JSONL
- 不做独立 OS 服务（App 退出即停）；独立进程可后续再拆
- 不导入 Shared Event Log
- 不在导入路径读 transcript 全文

## What Changes

- Rust：`session_index/importer.rs` 启动循环；tick 串行工作区、`force=false`
- 事件：`session-index-imported`
- FE：收到事件后对可见工作区再跑 first-paint SQLite
- Spec / 合同：三层数据面补「外部导入 = 后台」

## Capabilities

### New Capabilities

- `session-index-import-daemon`: 间隔、有界、幂等导入外部 CLI 会话。

### Modified Capabilities

- `workspace-sidebar-session-loading`: 导入完成后侧栏只再读 Index，不扫盘。

## 技术方案对比

| 选项 | 取舍 |
|---|---|
| 挂在 first-paint | 否决：已证明又慢又覆盖 |
| App 内 Tokio 循环 | 实现快，跟 App 同寿命。**本 change 采用** |
| 独立 OS daemon | 关 App 也能进。后续再拆 |
| 全量 walk | 否决：Codex GB 级 |

## 验收

1. 侧栏启动路径不调用 importer writers
2. 外部新建一条 Claude/Codex 会话，一个间隔内进 Index，侧栏再 SELECT 可见
3. 同一会话再 tick 不新增行
4. tombstone 行不被导入复活
5. 重叠 tick 被跳过

## Impact

`src-tauri/src/session_index/*`、`lib.rs` setup、侧栏 hydration 监听事件。
