# Tasks

- [x] 1.1 落盘 proposal / design / spec
- [x] 1.2 `openspec validate plugin-rack-real-install-loop --strict`
- [x] 2.1 lockfile：disk `installed|uninstalled`，缺省 Notes = installed，测试注入路径
- [x] 2.2 atomic contribution registry：Notes view + 7 commands 一次注册/撤销
- [x] 2.3 Host `prepare_install` + `activate_allowlisted`；一般 `activate` 仍 host-disabled
- [x] 2.4 产品命令 `install_plugin` / `uninstall_plugin` 挂 `plugin_rack`，allowlist 仅 Notes
- [x] 2.5 产品 setup `restore_allowlisted`；`boot_host()` 本身不激活
- [x] 2.6 插排快照补 installable / desiredState / contributionsLive；UI 仅 Notes 有按钮
- [x] 3.1 Notes 卸载：Host Uninstalled + isolate stop + 撤销 contribution + 保留 sqlite
- [x] 3.2 Notes 安装/重装：Ready + contribution 全量 + lockfile installed
- [x] 3.3 `note_card_*` 卸载闸门：默认 `plugin-uninstalled`，显式 `0` 仍走 core
- [x] 4.1 更新 D-050、`16-progress-dashboard.md`、卸载依赖链、changes README
- [x] 4.2 验收：focused rust + vitest + `openspec validate --strict`；无 Slim / 无 Marketplace
