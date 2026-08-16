# Wave 4H Self-Review

> 日期：2026-08-16  
> 范围：`notes-dual-run-call-surface`  
> 结论：**方向正确。停在调用面 flag 收口。** 对标 Claude 3AN「默认 off 调用面已齐」；未接插件运行时、未迁表、未切产品行为。

## 方向

| 检查 | 结果 |
|---|---|
| 7 条 `note_card_*` 命令入口加 `notes_owner()` 分发 | 通过。flag `MOSSX_NOTES_COMPAT_FACADE` 默认 off → Core |
| 单 owner（`CoreNotes`），非第二实现 | 通过。facade delegate 到同一 `*_core` 内部函数 |
| 不接插件运行时（不 activate / dispatch / storage） | 通过。delegate 只调 `note_cards::*_core`，不碰 `plugin_runtime` |
| 不删 `note_cards.rs` / `noteCards.ts` / feature | 通过 |
| 产品行为 0% 变化 | 通过。flag 默认 off，7 条命令走原 Core 路径 |

## 证明

- `cargo test --lib note_cards`：16 passed（抽取 `*_core` 后命令语义不变）
- `cargo test --lib notes_compat`：5 passed（`core_facade_exposes_a_single_core_owner`）
- `cargo test --lib plugin_runtime`：291 passed
- `npx tsc --noEmit`：exit 0
- `openspec validate notes-dual-run-call-surface --strict --no-interactive`

## 本轮连做（自主）

4E 门面 → 4G 组合面 disable → 运行时侧四类 gap（进程组 kill / interrupt / uninstall 终态）→ 4H 调用面 flag 收口。

产品行为仍为 0%。未接运行时新路径（step 6 conformance）、未迁表、未删 `note_cards`、未开 Marketplace。

## 下一刀（另开 change，需谨慎）

4I Conformance：flag on 时 7 条命令切到插件运行时 `notes_storage` namespace。**禁止**从 4H 直接跳到迁 `note_cards` 表——先过 conformance 与回退策略设计。
