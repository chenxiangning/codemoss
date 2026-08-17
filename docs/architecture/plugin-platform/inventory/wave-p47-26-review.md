# Wave P4.7-26 / 27 Self-Review

> 日期：2026-08-16  
> 范围：Notes 产品默认隔离库 + Host supervisor 独立进程  
> 结论：**方向正确。两根插头默认路径已切。插排 supervisor 已出进程。不 Slim，不宣称整平台完成。**

## 做了

- `MOSSX_NOTES_COMPAT_FACADE` 未设即 on；`0` 回 `note_cards` 文件
- 首次打开仍一次性导入存量 json
- `packages/plugin-host/src/supervisor.rs` 独立进程回 `host-disabled`
- `BootHost` spawn 该进程；pid ≠ 测试进程；drop 杀组 unlink
- `boot_driver()` 仍 `missing_executable()`

## 没做（有意）

- 不 Slim、不删 Core
- 不默认激活 Claude / Notes 到 BootHost
- 不开 Marketplace
- 不把 in-process Host 状态机整段搬进独立进程（那是下一阶段）
