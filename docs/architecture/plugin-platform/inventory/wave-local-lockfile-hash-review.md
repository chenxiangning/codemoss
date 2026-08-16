# Wave Local Lockfile Hash Self-Review

> 日期：2026-08-16  
> 范围：`plugin-local-lockfile-hash`  
> 结论：**方向正确。同一 pluginId+version 只能绑一个本地 artifactHash。** 冲突 fail closed。不读入口，不激活 Host。

## 证明

- `openspec validate plugin-local-lockfile-hash --strict --no-interactive`
- vitest local stage / catalog / PluginRack：9 passed
