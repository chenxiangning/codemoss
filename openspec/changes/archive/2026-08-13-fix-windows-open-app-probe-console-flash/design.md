# Design: 修复 Windows「打开方式」设置探测引发的瞬间黑窗

## Context

- 现状：`src-tauri/src/workspaces/commands.rs` 中，打开方式设置的宿主检测存在两条 Windows 子进程 spawn 路径：
  1. 图标提取 `get_windows_associated_icon_png_data_url` 直接 `std::process::Command::new("powershell")`（`commands.rs:2799`）。
  2. 命令探测 `command_resolvable_on_path`（Windows 分支）直接 `std::process::Command::new("where")`（`commands.rs:3152`）。
- 触发链路：设置页打开方式 tab active → `useOpenAppIcons` 逐行提取图标 + `useOpenAppTargetHealth` 自动探测目标与预设 → 每个 spawn 闪一次可见控制台窗口。
- 机制：GUI 进程 spawn console 子进程时，若不带 `CREATE_NO_WINDOW`，Windows 会为每个子进程临时创建可见控制台。
- 既有收口：`src-tauri/src/utils.rs` 的 `std_command` / `async_command` 已统一携带 `CREATE_NO_WINDOW`（并支持 `CODEMOSS_SHOW_CONSOLE=1` 逃生门），同文件 `commands.rs:2638`（打开 workspace）已在用；`commands.rs:2459` 处注明 Explorer 场景刻意不用该收口。

## Goals / Non-Goals

- Goals：消除两条探测路径的可见控制台弹窗；探测与图标语义零变化。
- Non-Goals：不优化 PowerShell 图标提取性能；不改 macOS / Linux 分支；不引入新依赖。

## Decisions

### 决策 1：复用 `crate::utils::std_command` 收口，而非新造 flag 工具

- 方案 A（选定）：两处 spawn 改用 `crate::utils::std_command`。
  - 优点：与仓库既有收口一致，自动获得 `CREATE_NO_WINDOW` 与 `CODEMOSS_SHOW_CONSOLE=1` 逃生门；改动为一行级替换。
  - 缺点：无。
- 方案 B：在 `workspaces/commands.rs` 内自建带 flag 的 helper。
  - 优点：局部自治。
  - 缺点：与 utils 收口重复（违反奥卡姆剃刀），且丢失逃生门一致性；未来审计会看到两个平行收口。
- 结论：选 A。

### 决策 2：仅替换 Windows 分支的 spawn，不改语义结构

- 方案 A（选定）：只把 `Command::new` 换成 `std_command`，参数、stdio 管道、返回值处理全部不动。
  - 优点：最小 diff；`where` / `powershell.exe` 均为真实 exe（非 .cmd wrapper），stdout 管道不受 flag 影响（utils.rs 注释中已知风险场景不适用）。
- 方案 B：顺带重构探测为纯注册表/文件系统查询，彻底去掉子进程。
  - 优点：性能更好、零 spawn。
  - 缺点：`where` 语义（PATH 解析 + PATHEXT + 当前目录）手写等价物容易踩边界；工作量与风险远超本次 bug 修复范围，违反 YAGNI。
- 结论：选 A；方案 B 记为未来优化方向。

### 决策 3：契约粒度 — 新增 capability 而非塞入导航 spec

- `openspec/specs/settings-navigation-consolidation` 只覆盖 tab 承载与定位，不覆盖宿主检测行为；本变更新增 `open-app-target-detection` capability 作为独立契约，避免污染导航 spec 的职责边界。

## Risks / Trade-offs

- [Windows 分支在本机（macOS）不可编译验证] → 改动均为 `#[cfg(windows)]` 内一行替换，复用已被同仓库其他链路验证的 `std_command`；CI 上 windows target 编译与既有测试兜底；验收标准写明 Windows 实机人工验证项。
- [`CREATE_NO_WINDOW` 影响 stdio 管道的已知场景] → 仅涉及 .cmd wrapper；本变更两个程序均为 exe，不适用；逃生门 `CODEMOSS_SHOW_CONSOLE=1` 可调试。
- [行为未被改变但探测耗时不变] → 属于非目标，不构成回滚理由；后续可单独立 change 优化图标提取。

## Migration Plan

- 部署：随下一次版本发布；无数据迁移、无配置变更。
- 回滚：`git checkout -- src-tauri/src/workspaces/commands.rs` 还原两处 spawn 即可；无持久化副作用。

## Open Questions

- 无。
