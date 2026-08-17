# Wave P4.7-22 Self-Review

> 日期：2026-08-16  
> 范围：`notes-dual-run-isolated-storage`  
> 论文对齐：`15` §3 Dual-run。4H 两路径都写 `note_cards` 文件，不是 dual-run。  
> 结论：**方向正确。flag-on 才是隔离 sqlite。产品默认仍文件。不称插头完成。**

## 本批做了

- `NotesCompatOwner::IsolatedNotes` + 注入根
- 7 条 `note_card_*` flag-on 走 `isolated_product()`
- 测试：隔离闭环不碰 `note_card`；flag 默认关；registry 仍绑 `note_cards`

## 本批没做（有意）

- 不迁存量 markdown
- 不默认开 flag、不 Slim
- 不宣称 Claude / Notes 产品默认路径完成

## 目标状态

真实插排 + Claude PE（opt-in）+ Notes 隔离 dual-run（opt-in）已落地。产品默认仍 Core。storage / rollback / Slim / Host 独立进程仍未做。目标未完成，不得 mark complete。
