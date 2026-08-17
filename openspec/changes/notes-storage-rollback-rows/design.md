# Design

```text
NotesNamespace
  checkpoint() → DiskStorage.checkpoint(com.mossx.notes)
  restore()    → DiskStorage.restore + 重建 notes 表句柄

验收
  create n1 → checkpoint → delete n1 → restore
  get(n1) 必须回来
  路径不含 note_card
```

产品 `note_card_*_core` 零改动。flag 默认关。
