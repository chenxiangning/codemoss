# plugin-engine-claude

Wave 3AK 过渡仓。`pluginId`：`com.mossx.engine.claude`。

本目录不是正式 `.mossx-plugin` 复合包，也不是独立 Git 仓库。

- 有：`.mossx-plugin/plugin.json`
- 没有：`dist/`、`bin/`、`integrity.json`、`signature.json`、SBOM
- 前端导入走：`@mossx/plugin-engine-claude/runtime`
- 不进 Host / boot / Marketplace
- 不删 `src-tauri/src/engine/claude*`
