# Design

只设计，不实施迁表。三条轴：数据映射、conformance 口径、回退策略。

## 一、数据映射（markdown 文件 → sqlite）

`WorkspaceNoteCard`（11 个字段）映射到 `notes` 表：

| 字段 | sqlite 列 | 说明 |
|---|---|---|
| id | `id TEXT PRIMARY KEY` | note uuid |
| workspace_id | `workspace_id TEXT NOT NULL` | 索引 |
| workspace_name / workspace_path | `workspace_name TEXT NULL` / `workspace_path TEXT NULL` | 定位 |
| project_name / title / body_markdown / plain_text_excerpt | 同名 TEXT | 正文 |
| attachments | `attachments_json TEXT` | 序列化 `Vec<NoteCardAttachment>` |
| source | `source_json TEXT NULL` | 序列化 `WorkspaceNoteCardSource` |
| created_at / updated_at / archived_at | INTEGER | 时间戳 |

附件二进制仍走文件（attachment blob 不入 sqlite），仅元数据入库；`relative_path`/`absolute_path` 指向运行时 data 目录，不读产品 `note_cards` 目录（沿用 4D 的隔离结论）。

## 二、conformance 验收口径

- **storage**：flag on 后 `create` 写入 `notes` 表、`list` 只读该 namespace、`get`/`update`/`archive`/`restore`/`delete` 全部命中 sqlite，且**不触碰**产品 markdown 文件。
- **rollback**：`checkpoint` 后 `migrate` schema → `restore` 回到上一 checkpoint schema（复用 `notes_storage` 已有测试语义）。
- **first-interactive**：flag on 冷启动，首次 `list` 不读产品目录、不阻塞主线程（这是 UI 层验收，迁表实施后单独 gate）。

## 三、回退策略

- **切换**：flag off → 7 条命令回到 markdown 文件路径（4H 现状）。
- **迁表原子性**：迁移用「单次事务 + checkpoint」，失败回滚到迁移前 checkpoint，不写半张表。
- **不变量**：flag on 与 off 之间，同一 note_id 不得出现「sqlite 已改、markdown 未改」的双写撕裂——迁表期间同一数据域只有一个 active owner（`15` §3 step 5）。

## 四、不做的

不实施迁表、不写存量文件、不改命令默认路径、不开 flag、不删 Core。真实 CLI 无关（Notes 无外部 CLI），但 storage conformance 验收必须在隔离 namespace 上真实跑通后才允许 step 7 disable。
