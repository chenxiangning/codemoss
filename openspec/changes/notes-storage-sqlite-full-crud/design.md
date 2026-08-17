# Design

```text
NotesNamespace（隔离 sqlite）
  get(id, workspace) → Option<WorkspaceNoteCard>
  list(workspace, archived) → Vec<WorkspaceNoteCard>
  update(id, workspace, patch) → WorkspaceNoteCard
  archive / restore / delete

产品
  command_registry → note_cards.rs
  本刀零改动
```

附件二进制仍不入库。update 只改已入库字段，不读产品目录。
