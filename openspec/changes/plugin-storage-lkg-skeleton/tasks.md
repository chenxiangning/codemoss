# Tasks

- [x] 1.1 `StorageService` 支持 `restore_to` 与 LKG checkpoint 保护
- [x] 1.2 `lkg.rs`：`plugin-lock.json` 原子读写，与产品 lockfile 分离
- [x] 1.3 `PluginRuntime.stage_own_update` / `complete_own_update`
- [x] 1.4 组合面测试：pass pin、fail restore、无 LKG quarantine、不写产品 lockfile
- [x] 1.5 `cargo test --lib plugin_runtime::`
- [x] 1.6 `openspec validate plugin-storage-lkg-skeleton --strict --no-interactive`
