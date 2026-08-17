# plugin-engine-claude

Wave 3AK 过渡仓。`pluginId`：`com.mossx.engine.claude`。

本目录不是正式 `.mossx-plugin` 复合包，也不是独立 Git 仓库。

- 有：`.mossx-plugin/plugin.json`、`src/process_entry.rs`（Host 拥有的 MXPC peer 源码）
- 没有：提交进仓的 `dist/` / `bin/` 预编译、`integrity.json`、`signature.json`、SBOM
- 当前平台制品由 `src-tauri/build.rs` 编到 `OUT_DIR/plugin-engine-claude/`，产品 flag-on 只解析该根
- 前端导入走：`@mossx/plugin-engine-claude/runtime`
- 不进 Host / boot / Marketplace
- 不删 `src-tauri/src/engine/claude*`
