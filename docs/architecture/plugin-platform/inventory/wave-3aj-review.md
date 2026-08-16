# Wave 3AJ Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-history-remaining-call-sites`  
> 论文对齐：产品操作已走门面；类型 / 常量 / helper 不是漏接。  
> 结论：**方向正确。只盘点，不改实现。** GUI / daemon / catalog / native continuation 的 history 操作已收口。残留是门面委托、catalog 类型、session index `encode_project_path`、实现与测试。未开产品 flag。未删 `engine/claude*`。

## 证明

- `plugin_runtime::claude_compat`：14 passed
- `openspec validate engine-claude-history-remaining-call-sites --strict --no-interactive`

## 下一刀

3AK：独立 Claude plugin 包骨架（`.mossx-plugin` / fixture），仍默认 off，仍禁止删 `engine/claude*`。
