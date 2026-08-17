# Wave P4.7-23 Self-Review

> 日期：2026-08-16  
> 范围：`notes-storage-rollback-rows`  
> 论文对齐：`15` §3 step 6 rollback。旧测试只验 schema 数字，不验 note 行。  
> 结论：**方向正确。隔离库能回滚行。产品默认仍文件。不称插头完成。**

## 本批做了

- `NotesNamespace::checkpoint` / `restore`
- 测试：create → checkpoint → delete → restore 后原 title 回来
- 路径仍隔离；产品命令仍绑 `note_cards`；flag 默认关

## 本批没做（有意）

- 不迁存量 markdown
- 不默认开 flag、不 Slim
- 不宣称产品默认路径完成

## 下一刀

产品默认仍 Core。还差：Claude 产品默认切 PE（或明确保持 opt-in）、Notes 存量迁表、Host 独立进程、Slim。
