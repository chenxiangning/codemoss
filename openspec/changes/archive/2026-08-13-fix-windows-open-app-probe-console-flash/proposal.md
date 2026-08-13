# Proposal: 修复 Windows「打开方式」设置探测引发的瞬间黑窗

## Why

Windows 下打开「设置 → 基础设置 → 打开方式」时，列表会对每条配置项与每个预设执行宿主检测（图标提取 + 路径探测），每次检测都会短暂弹出一个可见的控制台黑窗；macOS 无此现象。问题虽不影响功能，但破坏了设置页体验。

## 目标与边界

- 消除 Windows 下打开方式设置页所有检测触发的可见控制台弹窗。
- 保留既有检测语义：探测结果（`ok` / `missing` / `broken`）、图标提取结果、click-to-refresh 行为均不变。
- 改动仅限 `src-tauri/src/workspaces/commands.rs` 中 Windows 分支的进程 spawn 方式。

## 非目标

- 不优化图标提取的性能（PowerShell 逐行提取仍保留）。
- 不改 macOS / Linux 行为。
- 不改变打开方式列表、预设、健康状态 UI 的任何交互。

## What Changes

- `get_windows_associated_icon_png_data_url` 的 `powershell` 子进程与 `command_resolvable_on_path`（Windows 分支）的 `where` 子进程，改用 `crate::utils::std_command` 启动，携带 `CREATE_NO_WINDOW`，杜绝可见控制台窗口。
- 保留 `CODEMOSS_SHOW_CONSOLE=1` 调试逃生门（`std_command` 既有行为）。
- 无 **BREAKING** 变更。

## Capabilities

### New Capabilities

- `open-app-target-detection`: 「打开方式」设置的宿主检测（预设探测、目标探测、图标提取）在 Windows 上 MUST 不产生可见控制台窗口，且探测与图标结果语义保持不变。

### Modified Capabilities

（无 — 现有 specs 未覆盖该行为，本次为新增契约）

## Impact

- 代码：`src-tauri/src/workspaces/commands.rs`（两处 spawn，均为 `#[cfg(windows)]`）。
- 复用：`src-tauri/src/utils.rs` 既有 `std_command` 收口工具，无新依赖。
- 测试：`src-tauri/src/workspaces/commands.rs` 内 `probe_open_app_*` 测试保持绿；新增 Windows 分支的构造性检查。
- 平台：仅 Windows；macOS/Linux 无编译路径变化。
