# Proposal: engine-claude-pilot-inventory

> OpenSpec change id: `engine-claude-pilot-inventory`  
> Wave：3A（第一根插头 · 只盘点）  
> 架构：[`14` §17](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)、[`15` §3](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

Wave 2 已能在隔离目录回退文件。按插头协议，下一步是 Inventory，不是搬家。Claude 文件散落在 engine / commands / threads / vendors / i18n，不先钉死就会误删 Contract 或带走其他 CLI。

## 目标与边界

1. 落下 `docs/architecture/plugin-platform/inventory/claude-pilot.json`。
2. 标明 stay-in-Core vs 目标迁出 vs 禁止跟随。
3. **不修改**任何 Claude 生产代码。
4. 不删测试、不改 `EngineType`、不注册 Host。

## 非目标

- compatibility adapter
- 独立仓库 / `.mossx-plugin`
- disable-not-delete
- Codex 及其他 CLI

## Capabilities

### New Capabilities

- `engine-claude-pilot-inventory`：Claude 插头的可核对归属表

## 验收标准

1. inventory 覆盖 engine/claude*、claude_commands*、frontend claude* 主路径。
2. stay-in-Core 含 adapter_registry / EngineType。
3. `mustNotMoveWithClaude` 列出另外 6 个 CLI。
4. 本 change 的代码 diff 不含 `src-tauri/src/engine/claude*` 行为修改。
5. `openspec validate` 通过。
