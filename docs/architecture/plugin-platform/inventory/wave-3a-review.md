# Wave 3A Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-pilot-inventory`  
> 结论：**方向正确。停在 Inventory。** 下一刀才是 Claude Manifest 草稿（3B），不是删 `engine/claude*`。

## 方向

| 检查 | 结果 |
|---|---|
| 只盘点不搬家 | 通过。无 Claude 生产代码 diff |
| 第一根插头是 Claude | 通过。`pluginId=com.mossx.engine.claude` |
| 其他 CLI 不跟随 | 通过。`mustNotMoveWithClaude` 列出 6 家 |
| Engine Contract 留 Core | 通过。registry / EngineType 在 stay-in-Core |
| 未开 Marketplace | 通过 |

## 扫描摘要

- 文件名含 `claude`：61
- `command_registry` 命中：23
- `engine/claude/` 子模块仍在（approval / stream / lifecycle）

## 下一阶段边界（锁定）

**3B：`engine-claude-pilot` Manifest + exact `mossx.engine.provider`。**  
仍不接 App 启动、不 dual-run、不删 Core。

禁止从 3A 跳到 disable-not-delete。
