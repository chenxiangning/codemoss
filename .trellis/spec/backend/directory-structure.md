# Directory Structure（backend）

## 模块布局（基于当前代码）

```text
src-tauri/src/
  command_registry.rs
  state.rs
  storage.rs
  client_storage.rs
  engine/
  codex/
  workspaces/
  git/
  files/
  settings/
  local_usage/
  runtime_log/
  web_service/
```

## 落位规则

- command 函数按 domain 放在对应模块（如 `git/mod.rs`, `workspaces/mod.rs`）。
- command 注册统一在 `command_registry.rs`，禁止分散注册。
- 全局状态结构统一在 `state.rs`。
- 通用存储逻辑优先复用 `storage.rs` / `client_storage.rs`，避免重复造锁。

## 拆分规则

- 单文件过大时优先按 domain 子模块拆分（例如 `local_usage/*`）。
- 禁止按“技术类型”拆分成无业务语义目录（例如 `helpers_everything`）。
- 新增模块需在 `lib.rs`/`mod.rs` 中清晰导出，避免隐式依赖。

## 命名规则

- Rust 模块文件使用 `snake_case.rs`。
- command 名称与 frontend invoke 名保持语义一致。
- DTO/struct 命名保持 domain 语义，避免 `Data/Info/Temp`。
