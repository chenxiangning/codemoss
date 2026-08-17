# Design

```text
note_card/<project>/{active,archive}/*.json
  → read_note_card
  → 若 namespace.get(id) 已有则 skip
  → 否则 create_note

sentinel: plugin-runtime/data/com.mossx.notes/imported.lock
  有 sentinel 则不再扫
```

产品默认路径仍文件。导入只在显式调用或 flag-on 首次打开时跑。本刀测试用注入目录，不碰用户家目录。
