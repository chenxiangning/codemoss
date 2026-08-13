# Verification: add-session-index-import-daemon

- Importer: 45s 后启动，90s 间隔，`force=false` 有界 writers
- 重叠 tick 跳过（`overlapping_tick_is_rejected` 绿）
- `upserted>0` 才 emit；FE first-paint 再 SELECT
- 侧栏加载路径不 await importer
