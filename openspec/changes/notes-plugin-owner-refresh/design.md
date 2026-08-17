# Design

```text
产品 owner
  command_registry → note_card_* → note_cards.rs
  flag 关：直接 *_core
  flag 开：NotesCompatAdapter::core() 仍 delegate 回 *_core

隔离
  plugin-runtime/data/com.mossx.notes/store.sqlite
  不得出现产品 note_cards 路径

Claude dual-run
  MOSSX_CLAUDE_PROCESS_ENTRY 默认关
  send_message 仍 cmd.spawn()
```

本刀只改 inventory + 测试闸门。不改产品命令实现。
