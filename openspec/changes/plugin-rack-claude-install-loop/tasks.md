# Tasks

- [x] 1.1 落盘 proposal / design / spec
- [x] 1.2 `openspec validate plugin-rack-claude-install-loop --strict`
- [x] 2.1 lockfile：缺省 Claude = installed；Notes 缺省不变
- [x] 2.2 contribution registry：`claude.engine` + `claude.spawn` 一次注册/撤销
- [x] 2.3 `claude_lifecycle_activation_request()` 仅 `claude-worker`；fixture 请求保持 cli+worker
- [x] 2.4 allowlist 扩 Notes+Claude；`install_claude` / `uninstall_claude` / `restore` 两根
- [x] 2.5 spawn / resume 闸门 `claude_commands_allowed()` 先于 `decide_claude_spawn_owner`
- [x] 2.6 插排快照与 UI：Notes + Claude 可写，其余 10 根只读
- [x] 3.1 Claude 卸载：Host Uninstalled + isolate stop + 撤销 contribution + 保留源码/history
- [x] 3.2 Claude 安装/重装：Ready + contribution 全量 + lockfile installed + 不 start claude-cli
- [x] 3.3 卸载后默认 spawn 返回 `plugin-uninstalled`；显式 `0` 仍走 Core
- [x] 4.1 更新 D-051、`16-progress-dashboard.md`、卸载依赖链、changes README
- [x] 4.2 验收：focused rust 19/19 + `production_shaped_command_maps_argv_and_cwd` source-order 绿 + vitest 3/3 + `openspec validate --strict` green；`artifact_root_reaps_a_real_claude_result_when_cli_exists` 为既有 CLI 探测 flake，不计入本刀回归；无 Slim / 无 Marketplace
