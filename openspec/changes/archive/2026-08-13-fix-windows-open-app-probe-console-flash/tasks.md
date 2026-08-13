# Tasks: 修复 Windows「打开方式」设置探测引发的瞬间黑窗

## 1. 替换 icon 提取的 powershell spawn 为 std_command

- [x] 完成（`commands.rs` powershell spawn 已改用 `crate::utils::std_command`）
- 输入：`src-tauri/src/workspaces/commands.rs` `get_windows_associated_icon_png_data_url`（`#[cfg(windows)]`）
- 动作：`std::process::Command::new("powershell")` → `crate::utils::std_command("powershell")`；参数、stdio、输出解析不动
- 输出：该函数仅通过 `std_command` 启动子进程
- 验证：`cargo check --manifest-path src-tauri/Cargo.toml` 编译通过；无行为断言变化
- 优先级：P0；依赖：无

## 2. 替换 where 探测 spawn 为 std_command

- [x] 完成（`command_resolvable_on_path` Windows 分支 where spawn 已改用 `crate::utils::std_command`）
- 输入：`src-tauri/src/workspaces/commands.rs` `command_resolvable_on_path` Windows 分支（`#[cfg(windows)]`）
- 动作：`std::process::Command::new("where")` → `crate::utils::std_command("where")`；参数、stdio、status 判断不动
- 输出：Windows 分支仅通过 `std_command` 启动子进程
- 验证：`cargo check --manifest-path src-tauri/Cargo.toml` 编译通过
- 优先级：P0；依赖：无（可与任务 1 并行）

## 3. 回归：Rust 测试与全量 gate

- [x] 完成（`cargo check` 无 error；`cargo test --lib workspaces` 113/113 绿；`openspec validate` 本 change valid）
- 已知既有失败（与本次无关）：`assemble_canonical_facts` 集成测试引用已归档 change 的 fixture 目录，编译失败；openspec 全量 validate 有 5 个其他 change 的既有失败
- 输入：任务 1、2 的 diff
- 动作：运行 `cargo test --manifest-path src-tauri/Cargo.toml`；运行 `openspec validate --all --strict --no-interactive`
- 输出：相关测试全绿，validate 通过
- 验证：`probe_open_app_presets_sync_returns_catalog_entries` 等 workspaces 模块测试通过
- 优先级：P1；依赖：任务 1、2

## 4. Windows 实机人工验证（记录 QA 证据）

- [x] 完成（用户 Windows 实机人工测试通过，2026-08-13 口头确认；覆盖 specs 全部三个 Scenario：列表激活、预设对话框探测、健康徽标重新验证，均无可见控制台弹窗，图标与健康状态正常）
- 输入：包含任务 1、2 改动的 Windows 构建
- 动作：打开「设置 → 基础设置 → 打开方式」，观察列表激活、打开添加对话框、点击健康徽标重新验证三个场景
- 输出：确认无可见控制台弹窗；图标与健康状态正常；`CODEMOSS_SHOW_CONSOLE=1` 下窗口恢复可见
- 验证：按 specs 三个 Scenario 逐条目视记录（含截图/日志），证据写入 change 目录
- 优先级：P1；依赖：任务 3
