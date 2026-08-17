# Proposal: project-map-plugin-storage-namespace

> OpenSpec change id: `project-map-plugin-storage-namespace`  
> Wave：5E1（第三根插头 · Conformance 前置 · 隔离 namespace · P4.7-34）  
> 依赖：`project-map-plugin-dual-run`（5D 调用面 Dual-run）  
> 对标：`notes-plugin-storage-namespace`（Wave 4D）  
> 架构：[`15` §3 step 6 Conformance](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

5D 已把 24 条命令接到默认 off 的门面，但 flag on/off 仍写同一组 Core 目录（`~/.ccgui/project-map*` / `project-memory`）。没有隔离 namespace，就没有「新路径」，Conformance 的 storage / rollback 只能假绿。

本刀对标 Notes 4D：只在**注入 temp 根**打开 `com.mossx.project-map` 的 DiskStorage namespace，证明 checkpoint / restore 能回到 schema 1。不读产品目录，不切 24 条命令，不迁用户数据。

## 目标与边界

1. `project_map_storage.rs` 用 `DiskStorage::open(injected_root)` 打开 `com.mossx.project-map`。
2. 路径必须是 `plugin-runtime/data/com.mossx.project-map/store.sqlite`。schema 对齐 fixture `storage.schemaVersion=1`。
3. checkpoint 后改 schema，restore 回到 1。
4. **禁止**读 `~/.ccgui/project-map*` / `project-memory` / `app_paths` / 产品 `project_map.rs` 写入路径。
5. **禁止**改 24 条产品命令的默认路径、禁止默认开 flag、禁止 activate / dispatch。
6. **禁止**做 CRUD / 迁表 / Disable / D-052 真实装/卸（那些是 5E2+ / 5F / 5G）。

## 非目标

- 把现有 map / relations / memory 文件导入新库
- 产品 command 切到隔离库
- disable-not-delete、插排可写、Marketplace

## Capabilities

- `project-map-plugin-storage-namespace-v1`

## 验收标准

1. temp 根下存在 Project Map sqlite。
2. restore 回到 checkpoint schema 1。
3. 源码不含产品 map / memory 路径硬编码。
4. `openspec validate project-map-plugin-storage-namespace --strict --no-interactive` 通过。
