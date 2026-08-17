# Design

```text
未设 / 1 / true → IsolatedProjectMap + import_legacy_once
0 / false / off → *_core 文件
源 json / 日期文件保留

import_legacy_once:
  lock = plugin-runtime/data/com.mossx.project-map/imported.lock
  已存在 → 0
  app_home/project-map/<key>/**        → map_files（跳 backups/，跳已有）
  app_home/project-map-relations/<key>/** → relation_files
  project-memory/settings.json         → put_settings
  project-memory/{slug}--{uuid8}/*.json → read_date_file → upsert if none
  写 lock（即使 0 条）
```
