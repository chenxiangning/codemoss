# Tasks

- [x] 1.1 落盘 proposal / design / spec delta
- [x] 1.2 `openspec validate engine-claude-process-entry-spawn-plan --strict --no-interactive`
- [x] 1.3 `SuperviseTarget` 增加 cwd；Process Entry supervise 吃 argv + cwd
- [x] 1.4 从生产 Command 抽出 SpawnPlan + 单 owner 闸门
- [x] 1.5 测试：生产形 plan 可 supervise；相对/shell/坏 cwd fail closed
- [x] 1.6 测试：flag 默认 off 仍 `cmd.spawn()`；flag on 不 spawn
- [x] 1.7 更新缺口盘点：1c 接线已建，stream 未切
