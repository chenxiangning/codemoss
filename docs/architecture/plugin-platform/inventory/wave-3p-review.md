# Wave 3P Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-core-accessor`  
> 论文对齐：隔离 = 独立上下文；散落字段访问是未声明依赖。  
> 结论：**方向正确。EngineManager 内部 flag-off 只走 `core_claude()` / `core_claude_arc()`。** 产品模块仍不得摸字段。未删 `engine/claude*`。未开产品 flag。

## 证明

- `plugin_runtime::claude_compat`：13 passed
- `engine::manager::tests`：13 passed
- `openspec validate engine-claude-core-accessor --strict --no-interactive`

## 下一刀

3Q：盘点 send / history 是否还有第二份 owner，或把 flag-on / flag-off 收成单一 `claude_owner()` 分发。禁止从此处删 Claude。
