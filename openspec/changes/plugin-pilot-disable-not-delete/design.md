# Design

```text
未设旗
  Claude coreOwner = disabled   productPath = process-entry
  Notes  coreOwner = disabled   productPath = isolated-sqlite
  源码仍在

显式 0
  Claude coreOwner = fallback   cmd.spawn()
  Notes  coreOwner = fallback   note_card_*_core

later-plugin
  coreOwner = active
```

Disable 改的是默认 owner，不是删实现。Slim 另开刀。
