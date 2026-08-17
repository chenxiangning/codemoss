# Proposal: project-map-plugin-isolated-storage

> OpenSpec change id: `project-map-plugin-isolated-storage`  
> Wave：5E2（第三根插头 · 隔离库读写合同 · P4.7-35）  
> 依赖：`project-map-plugin-storage-namespace`（5E1 隔离插座）  
> 对标：`notes-storage-sqlite-full-crud`（Notes 4J 第 2 步）  
> 架构：[`15` §3 step 6 Conformance](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

5E1 只通电了 `com.mossx.project-map` 的 sqlite 插座。checkpoint / restore 能回到 schema 1，但库里没有 map / relations / memory 行。没有读写合同，5E 切流只能继续写 `~/.ccgui/project-map*` / `project-memory`，Conformance 仍假绿。

本刀对标 Notes 全量 CRUD：在**注入 temp 根**上补 `ProjectMapNamespace` 读写与 rollback 行。不切 24 条产品命令，不迁用户目录，不改 flag 默认。

## What Changes

- 新增 `ProjectMapNamespace`：map / relations 以 blob 存，memory / settings / embed-index 以表存。
- 注入根测试覆盖 create / get / update / delete 与 checkpoint 后 restore 行。
- 24 条产品命令仍走 5D `*_core` 文件路径。

## 目标与边界

1. `ProjectMapNamespace` MUST 在注入根 sqlite 上读写 map blob、relations blob、memory item、settings、embed-index。
2. 路径 MUST 仍是 `plugin-runtime/data/com.mossx.project-map/store.sqlite`。
3. checkpoint 后删除行，restore MUST 把行读回来。
4. **MUST NOT** 改 24 条产品命令默认路径，**MUST NOT** 迁 `~/.ccgui`，**MUST NOT** 默认开 flag。
5. **MUST NOT** Disable / D-052 真实装/卸 / 可视化插排。

## 非目标

- 产品 command 切到隔离库（下一刀 5E 切流）
- 存量 `~/.ccgui/project-map*` / `project-memory` 导入
- 把 24 条命令写成第二套实现
- Disable-not-delete、allowlist、Marketplace、Slim

## 技术方案取舍

| 选项 | 做法 | 取舍 |
| --- | --- | --- |
| A. 镜像 24 条 command 到第二套实现 | 隔离库重写 scan / embed / reconcile | 违反 Dual-run「不是第二套实现」 |
| B. persist blob + 表（选用） | map/relations 当文件 blob；memory/settings/embed-index 当表 | 切流时 persist 换库，compute 仍走 Core |
| C. 直接切产品命令 | 本刀同时改 24 条默认路径 | 5E1 边界禁止；产品数据会在未验收前搬家 |

选 B：本刀只证明新路径可独立读写。

## Capabilities

### New Capabilities

- `project-map-plugin-isolated-storage-v1`：注入根隔离 CRUD + rollback 行

### Modified Capabilities

- 无。5E1 namespace 插座行为不变。

## Impact

- `src-tauri/src/plugin_runtime/project_map_storage.rs`
- 测试：`cargo test --lib plugin_runtime::project_map_storage`
- 产品 `project_map.rs` / `project_memory/**` 默认路径不变

## 验收标准

1. 注入根可写回 map blob、memory item、settings、embed-index。
2. checkpoint 后删行，restore 读回原行。
3. 24 条产品命令仍绑 `*_core`；flag 默认仍关。
4. `openspec validate project-map-plugin-isolated-storage --strict --no-interactive` 通过。
