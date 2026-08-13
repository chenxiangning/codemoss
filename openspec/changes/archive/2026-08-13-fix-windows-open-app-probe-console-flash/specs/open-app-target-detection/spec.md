# open-app-target-detection Spec Delta

## ADDED Requirements

### Requirement: Windows 宿主检测 MUST NOT 弹出可见控制台窗口

「打开方式」设置在 Windows 上执行的宿主检测（预设探测 `probe_open_app_presets`、目标探测 `probe_open_app_target` 的 `where` 子进程，以及图标提取 `get_open_app_icon` 的 `powershell` 子进程）SHALL 通过 `crate::utils::std_command` 启动，携带 `CREATE_NO_WINDOW`，不得产生可见控制台窗口。

#### Scenario: 打开方式列表激活时不闪黑窗
- **WHEN** Windows 用户打开「设置 → 基础设置 → 打开方式」，列表对每条配置项执行图标提取与健康探测
- **THEN** 系统 MUST NOT 弹出任何可见控制台窗口
- **AND** 图标与健康状态 MUST 仍正常渲染

#### Scenario: 添加预设对话框探测不闪黑窗
- **WHEN** Windows 用户打开「打开方式」的添加对话框，系统对预设列表执行探测
- **THEN** 系统 MUST NOT 弹出任何可见控制台窗口
- **AND** 预设的 installed / missing 状态 MUST 仍正确展示

#### Scenario: 点击重新验证不闪黑窗
- **WHEN** Windows 用户对某条打开方式点击健康状态徽标触发重新验证
- **THEN** 系统 MUST NOT 弹出任何可见控制台窗口
- **AND** 重新验证结果 MUST 与修复前一致

### Requirement: 检测语义与调试逃生门保持不变

宿主检测的返回语义 SHALL 不变：`status`（`ok` / `missing` / `broken`）、`installed`、`resolvedPath` 与图标提取结果 MUST 与修复前一致；环境变量 `CODEMOSS_SHOW_CONSOLE=1` MUST 仍能恢复可见控制台窗口用于调试。

#### Scenario: 探测结果语义等价
- **WHEN** 修复后的检测命令在 Windows 上执行
- **THEN** `probe_open_app_target` / `probe_open_app_presets` 的返回字段 MUST 与修复前完全一致
- **AND** `get_open_app_icon` MUST 仍返回与修复前相同的数据 URL 或 null

#### Scenario: 调试逃生门可用
- **WHEN** Windows 用户设置环境变量 `CODEMOSS_SHOW_CONSOLE=1` 后执行宿主检测
- **THEN** 检测子进程 MUST 恢复可见控制台窗口（便于调试 stdio 管道问题）
