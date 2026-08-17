# Tasks: plugin-storage-lkg-product-path

## 1. Durable root + disk adopt

- [x] 1.1 `boot_host_at(root)`；`boot_host()` 保持 ephemeral
- [x] 1.2 `lib.rs` setup 用 `app_home_dir()` 调 `boot_host_at`，失败回退 ephemeral
- [x] 1.3 `DiskStorage::adopt_plugin` / `restore_pinned`：不覆盖盘上 schema；checkpoint 文件可直接拷回

## 2. Runtime + 三根产品路径

- [x] 2.1 `PluginRuntime::establish_own_lkg`：无 pin 则 checkpoint+commit；有 pin 不健康则 restore
- [x] 2.2 `install_notes` / `install_claude` / `install_project_map` 在 Ready 后调用 establish
- [x] 2.3 uninstall 不删 pin / sqlite / checkpoint

## 3. 验证与口径

- [x] 3.1 focused rust：三根独立 pin、同 root 重启读回、schema 回滚、卸后留 pin
- [x] 3.2 校准 dashboard / D-054；不把 P2.5 / P2.6 / P2.7 整行勾完
