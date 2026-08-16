# Wave 4I Self-Review

> 日期：2026-08-16  
> 范围：`notes-conformance-storage-cutover`  
> 结论：**方向正确。停在迁表设计 + conformance 口径 + 回退策略。** 未实施迁表、未写存量文件、未删 Core。

## 方向

| 检查 | 结果 |
|---|---|
| 迁表设计（markdown → sqlite）只落文档 | 通过。design.md 给字段映射 + 迁移/回退策略，无实现代码 |
| conformance 口径覆盖 storage / rollback / first-interactive | 通过。spec 给三类 scenario |
| 不实施迁表 / 不写 `note_cards` 存量 | 通过。无 note_cards 文件写入 |
| 不改 7 条命令默认（off）路径 | 通过。4H 的 flag 默认 off 保持不变 |
| 不删 `note_cards.rs` / `noteCards.ts` / feature | 通过 |

## 证明

- `openspec validate notes-conformance-storage-cutover --strict --no-interactive`
- `src/note_cards.rs`、`src/services/tauri/noteCards.ts`、`src/features/note-cards/**` 仍在
- 无产品行为变化（本刀纯设计）

## 下一刀（另开 change，实施迁表时需真实跑通 storage conformance）

4J：实施迁表。必须先过 storage conformance（隔离 namespace 上 create/list/rollback 全命中 sqlite），再谈 step 7 disable-not-delete。
