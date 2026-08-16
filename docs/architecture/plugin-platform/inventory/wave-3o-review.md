# Wave 3O Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-config-facade`  
> 论文对齐：隔离 = 独立上下文；pub 字段是未声明依赖。  
> 结论：**方向正确。config 已接到默认 off 门面，`claude_manager` 不再公开。** 产品模块不得再摸字段。未删 `engine/claude*`。未开产品 flag。

## 证明

- `plugin_runtime::claude_compat`：13 passed
- `engine::manager::tests`：13 passed
- `openspec validate engine-claude-config-facade --strict --no-interactive`

## 下一刀

3P：`EngineManager` 内部 flag-off 分支仍直打 `self.claude_manager`。可再收一层 `core_claude()` 私有入口，或盘点 send/history 是否还有第二份 owner。禁止从此处删 Claude。
