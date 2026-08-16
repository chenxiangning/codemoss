# Proposal: notes-conformance-storage-cutover

> OpenSpec change id: `notes-conformance-storage-cutover`  
> Wave：4I（第二根插头 · conformance + 迁表设计）  
> 依赖：`notes-dual-run-call-surface`（4H 调用面 flag 收口，已归档）  
> 架构：[`15` §3 step 6 Conformance](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md) · [`03` §10 Uninstall / §2 Atomic Activation](../../../docs/architecture/plugin-platform/03-lifecycle-hot-swap-and-rollback.md)

## Why

4H 已把 7 条 `note_card_*` 命令入口接到 `notes_owner()` 分发，但 flag `MOSSX_NOTES_COMPAT_FACADE` on/off 目前都 delegate 到**同一个 Core 文件存储**（`note_cards.rs` 的 markdown 文件），不构成真正的 dual-run——没有「新路径」。

真正的「新路径」是插件运行时的隔离 namespace：`notes_storage.rs` 已具备 `open_notes_namespace`（sqlite `plugin-runtime/data/com.mossx.notes/store.sqlite` + checkpoint/restore）。step 6 Conformance 要让 flag on 时 7 条命令切到这个 sqlite namespace，使「卸载 = 撤销运行时 contribution + 停真实进程」真正作用于 Notes 数据面。

但这一步是**数据模型迁移**（markdown 文件 → sqlite），触碰用户数据，是 wave review 反复标注的「禁止从 pilot 跳到迁表」。本刀**只做设计 + 验收口径 + 回退策略，不实施迁表、不碰用户数据**，把风险钉死在动手之前。

## 目标与边界

1. 落盘「迁表设计」：`WorkspaceNoteCard` 的字段 → sqlite 表 schema 映射；存量 markdown → sqlite 的一次性迁移 + 增量写入策略。
2. 落盘「conformance 验收口径」：storage（读写隔离）/ rollback（checkpoint restore）/ first-interactive 的明确 scenario。
3. 落盘「回退策略」：flag off 回到 markdown 文件，迁表期间的数据一致性 + 失败回滚。
4. **MUST NOT** 实施迁表、MUST NOT 写 `note_cards` 存量文件、MUST NOT 改 7 条命令的默认（off）路径、MUST NOT 开 flag。
5. MUST NOT 删 `note_cards.rs` / `noteCards.ts` / feature（Slim 是 step 8）。

## Capabilities

- `notes-conformance-storage-cutover-v1`
