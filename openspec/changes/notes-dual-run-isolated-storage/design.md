# Design

```text
flag off
  note_card_* → *_core → ~/.ccgui/note_card

flag on
  note_card_* → NotesCompatAdapter::isolated_product()
             → NotesNamespace(app_home)
             → ~/.ccgui/plugin-runtime/data/com.mossx.notes/store.sqlite
```

同一 note_id 不双写。存量 markdown 不自动导入。测试用注入 temp 根，不碰用户家目录。
