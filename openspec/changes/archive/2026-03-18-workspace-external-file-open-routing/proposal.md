## Why

当前 `session activity` 的 `File change` 点击链路默认按 workspace 内文件读取处理。  
当事件路径指向 workspace 外部文件（典型是外部 OpenSpec 根目录）时，会触发 `Invalid file path`，导致用户无法在活动面板直接打开真实变更文件。

## What Changes

- 为 `File change` 点击打开增加“路径目标分流”逻辑：`workspace`、`external spec root`、`other external path`。
- 保持现有 workspace 内打开链路不变，仅在检测到外部 OpenSpec 根目录命中时新增读取分支。
- 为无法安全归属（既不在 workspace，也不在活动 external spec root）的路径提供可恢复提示，不中断会话交互。
- 增加 Win/Mac 路径归一化与匹配规则（分隔符、盘符、大小写敏感差异）。

## Capabilities

### New Capabilities
- `none`: No brand-new capability folder is introduced; this change extends existing behavior contracts.

### Modified Capabilities
- `codex-chat-canvas-workspace-session-activity-panel`: file-change jump action requirement is extended to support external spec root targets safely.
- `spec-hub-external-spec-location`: active external spec root contract is extended as a first-class read target for session activity file jumps.

## Impact

- 前端：`session activity` 跳转路径解析、文件面板读取入口分流、错误提示文案。
- 后端/Tauri：复用或扩展 external spec file read API 调用路径，不破坏现有 workspace boundary safety。
- 测试：新增/更新 Win/Mac 路径归一化、external root 命中、回退提示与无回归用例。
