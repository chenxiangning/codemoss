# Wave 3E Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-dual-run-flag`  
> 结论：**方向正确。停在默认关闭的切流。** Wave 3 仍未完成（未 disable-not-delete）。下一刀开 **Wave 4A Notes Inventory**，禁止从此处删 `engine/claude*`。

## 方向

| 检查 | 结果 |
|---|---|
| flag 默认 off | 通过。未设 env → false；`new_with_claude_compat(false)` 不构造门面 |
| 无第二份 session 表 | 通过。`wrapping(claude_manager)`；flag on 时 getter 与 core `Arc::ptr_eq` |
| 单 owner | 通过。仍只有 `CompatOwner::CoreClaude` |
| 未替换 registry | 通过。3D 断言仍绿 |
| 未删 Core / 未搬 history | 通过。`engine/claude*` 无行为 diff |
| 未开 Notes / Marketplace | 通过 |

## 证明

- `plugin_runtime::claude_compat`：5 passed
- `engine::manager::tests::claude_compat_flag_is_off_when_injected_false`
- `engine::manager::tests::flagged_claude_path_still_shares_core_sessions`
- `openspec validate engine-claude-dual-run-flag --strict --no-interactive`

## 颗粒度

3E 只切 `get_claude_session*`。没有把 send/interrupt/history 一并改掉，也没有开第二个 live owner。这是对的。

**Wave 3 明确未做：**

- disable-not-delete / 删 `engine/claude*`
- 独立仓库 / `.mossx-plugin`
- Host 挂进启动链
- 默认打开 flag

这些必须等 Notes 插头走完 Inventory → Contract，且 Claude flag 有独立回滚证据后再议。现在删 Claude 会跑偏。

## 下一阶段边界（锁定）

**Wave 4A：`notes-plugin-pilot-inventory`。**  
只盘点 Notes 落点（`note_cards` / workspace notes UI / commands）。  
禁止：迁 Notes 表、写产品 `app-data`、顺手 disable Claude。
