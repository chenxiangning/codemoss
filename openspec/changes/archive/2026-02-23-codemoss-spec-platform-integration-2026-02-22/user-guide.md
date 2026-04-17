# Spec Hub 用户指南（OpenSpec First）

## 1. 首次接入

1. 在 CodeMoss 选择目标 workspace。
2. 进入 `Spec Hub`。
3. 顶部查看 provider 与 support-level：
    - `OpenSpec + Full`：完整执行模式。
    - `Spec-Kit + Minimal`：只读 + passthrough 模式。

## 2. Doctor 与模式切换

- `Environment Doctor` 会展示 Node/OpenSpec/Spec-Kit 的可用性、版本与路径。
- 模式：
    - `Managed`：推荐默认。UI 会提供安装/恢复提示。
    - `BYO`：复用系统已有 CLI 与 PATH。
- 模式按 workspace 级持久化。

## 3. 变更执行流

1. 左侧 `Changes` 选中目标 change（支持 Active/Blocked/Archived 筛选）。
2. 中间 `Artifacts` 查看 proposal/design/specs/tasks/verification。
3. 右侧 `Actions` 执行：
    - `Continue`
    - `Apply`
    - `Verify`
    - `Archive`
4. 底部 `Timeline` 查看动作和验证日志，支持展开/收起。

## 4. 验证与门禁

- `Validation Panel` 会结构化展示失败项（target/reason/hint）。
- 点击失败项可自动跳转对应 artifact tab。
- `Gate` 聚合显示：provider / environment / artifacts / validation。

## 5. Spec-Kit 最小兼容

- Minimal 模式下动作不在 CodeMoss 内原生执行。
- UI 提供：
    - 只读 artifact 浏览
    - passthrough 命令预览
    - 官方文档跳转入口

## 6. 常见问题

### Q1: 无法执行 Verify

- 先确认 Doctor 中 `Node` 与 `OpenSpec CLI` 均为可用。
- 再确认 artifacts 至少包含 proposal/design/specs/tasks。

### Q2: 页面显示 Blocked

- 查看顶部 blocker 与 Doctor hints，按提示修复后点击 `刷新`。

### Q3: 为什么 Spec-Kit 按钮不可点？

- 当前策略为最小兼容，不做完整动作语义；请走 passthrough 外部命令。
