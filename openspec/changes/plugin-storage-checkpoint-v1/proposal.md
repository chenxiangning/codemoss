# Proposal: plugin-storage-checkpoint-v1

> OpenSpec change id: `plugin-storage-checkpoint-v1`  
> Wave：2A（插座通电 · Storage 合同，无真实用户库）  
> 架构：[`14` §12](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)、[`04`](../../../docs/architecture/plugin-platform/04-storage-migration-and-checkpoint.md)  
> 依赖：Wave 1 内存平面已收口。本 change **不依赖** UDS / QuickJS。

## Why

没有可靠回退就不能迁 Notes。若先写真实 SQLite 到 `app-data/`，会和产品 DB 缠死。2A 只做 **namespace 路径规则、四轴版本、checkpoint 元数据、destructive/export 闸门** 的纯函数服务。磁盘 IO 留给 2B。

## 目标与边界

1. 每个 `pluginId` 一个逻辑 namespace：`plugin-runtime/data/<pluginId>/`。
2. 四轴独立：`pluginVersion` / `contractVersion` / `storageSchemaVersion` / `checkpointFormatVersion`。
3. 更新前必须先 `checkpoint`；失败不得进入 migrate。
4. destructive migration 无用户确认 → 拒绝；`exportRequired` 未完成 → 拒绝。
5. 旧代码不得打开更高 `storageSchemaVersion`（quarantine）。
6. 不写真实用户目录、不改 Notes 表、不接 App 启动链。

## 非目标

- 真实 sqlite 文件 / blobs 目录
- 把 Notes 数据迁出 Core
- transport / QuickJS
- Marketplace lockfile 落盘

## Capabilities

### New Capabilities

- `plugin-storage-namespace-v1`：每插件路径与四轴版本
- `plugin-storage-checkpoint-v1`：checkpoint 必做、retain 1–5
- `plugin-storage-migration-gate-v1`：compatible / destructive / export / unknown schema

## 验收标准

1. namespace 路径含 `pluginId`，不含其他插件 id。
2. 无 checkpoint 的 migrate 被拒绝。
3. destructive 且 `confirmed=false` 被拒绝。
4. `exportRequired=true` 且未 export 被拒绝。
5. reader schema < store schema → `quarantine`。
6. `openspec validate` 通过；无 `std::fs` 写用户路径。
