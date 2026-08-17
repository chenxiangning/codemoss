# Design

`ProjectMapBackend` trait：`read`。`MemoryProjectMapBackend` 给单测。产品 `project_map` / `project_memory` 委托留给后续 Dual-run（flag on 才切 command）。本刀不改 `command_registry`，不 activate Host。

```text
5C
  ProjectMapCompatAdapter
    owner = CoreProjectMap
    pluginId = com.mossx.project-map
    commandIds = inventory 24 条
    flag = MOSSX_PROJECT_MAP_COMPAT_FACADE 默认 off

不做
  Host activate / lockfile install
  迁 sqlite / 改产品文件
  Slim / Marketplace
  给 browser / canvas / 其余 CLI 套同一模板
```

Notes 产品门面后来默认 on，那是 Dual-run 收口后的状态。知识地图本刀必须保持默认 off，避免第三根还没 Dual-run 就假装切流。
