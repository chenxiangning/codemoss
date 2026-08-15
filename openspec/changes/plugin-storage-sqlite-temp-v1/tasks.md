# Tasks: plugin-storage-sqlite-temp-v1

- [x] 1.1 `DiskStorage` 注入 root，创建 plugin-scoped sqlite
- [x] 1.2 checkpoint 复制文件；restore 覆盖
- [x] 1.3 两插件文件隔离
- [x] 1.4 无产品路径硬编码
- [x] 1.5 `cargo test --lib plugin_runtime::disk_storage`
- [x] 1.6 `openspec validate plugin-storage-sqlite-temp-v1 --strict --no-interactive`
