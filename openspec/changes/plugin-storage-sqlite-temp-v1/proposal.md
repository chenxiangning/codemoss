# Proposal: plugin-storage-sqlite-temp-v1

> OpenSpec change id: `plugin-storage-sqlite-temp-v1`  
> Wave：2B（插座通电 · 隔离 temp sqlite）  
> 依赖：`plugin-storage-checkpoint-v1`  
> 架构：[`14` §12](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)

## Why

2A 闸门已绿，但还没有证明「物理文件也能回退」。若直接写产品 `app-data/` 或 Notes DB，故障会毁掉用户数据。2B 只在 **调用方注入的根目录**（测试用 temp）创建 `store.sqlite` + checkpoint 副本。

## 目标与边界

1. `DiskStorage` 根路径由构造注入，默认不指向用户 app-data。
2. 每插件目录：`<root>/plugin-runtime/data/<pluginId>/store.sqlite`。
3. checkpoint 复制到 `<root>/plugin-runtime/checkpoints/<pluginId>/<id>/store.sqlite`。
4. migrate / restore 复用 2A 闸门；restore 用文件覆盖。
5. 禁止硬编码产品 Notes / session 路径。

## 非目标

- 改产品 `client_storage` / `note_cards` 表
- 把 Host 挂进 boot
- UDS / QuickJS / Claude

## Capabilities

### New Capabilities

- `plugin-storage-sqlite-temp-v1`：注入根目录的 sqlite + 文件级 checkpoint

## 验收标准

1. temp 根下出现 plugin-scoped sqlite。
2. checkpoint 后改 schema，restore 回到旧文件内容。
3. 两个 pluginId 的文件互不覆盖。
4. 源码不含 `note_cards` / 产品 app-data 硬编码。
5. `openspec validate` 通过。
