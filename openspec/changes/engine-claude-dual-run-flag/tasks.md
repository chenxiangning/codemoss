# Tasks: engine-claude-dual-run-flag

- [x] 1.1 `wrapping` + 默认 off 的 flag 解析
- [x] 1.2 `EngineManager` 可注入 flag；on 时经门面
- [x] 1.3 同一 `Arc`，无第二份 session 表
- [x] 1.4 不改 `engine/claude*` 行为
- [x] 1.5 `cargo test --lib plugin_runtime::claude_compat --lib engine::manager`
- [x] 1.6 `openspec validate engine-claude-dual-run-flag --strict --no-interactive`
