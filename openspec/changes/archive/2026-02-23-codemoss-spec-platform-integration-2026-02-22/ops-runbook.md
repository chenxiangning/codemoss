# Spec Hub 运维与支持手册

## 1. 诊断入口

- UI：Spec Hub -> Environment Doctor
- CLI：在 workspace 内执行
    - `openspec validate <change-id> --strict`

## 2. 关键信息采集

### 2.1 环境信息

- Node 路径与版本
- OpenSpec 路径与版本
- Spec-Kit 路径与版本（可选）
- 模式（Managed/BYO）

### 2.2 工作流信息

- 当前 provider/support-level
- 当前 change 状态
- Gate 检查结果
- Timeline 最近事件（action/validate/git-link）

## 3. 常见故障与处理

### 故障 A：OpenSpec 缺失

- 症状：Doctor 中 `OpenSpec CLI` missing
- 处理：安装 CLI 并确保 `openspec --version` 可执行
- 回退：切换 BYO 并使用已配置环境

### 故障 B：verify 失败但定位困难

- 症状：执行失败，输出较长
- 处理：查看 Validation Panel 的结构化条目并跳转对应 artifact

### 故障 C：Spec-Kit 用户认为功能缺失

- 说明：当前为最小兼容策略（read-only + passthrough）
- 处理：引导使用外部命令，或切换 OpenSpec full-support

## 4. 升级建议

- 优先保证 OpenSpec 路径健康（OpenSpec-first）
- 定期跑 `openspec validate --strict`
- 在发布前跑 typecheck + vitest + 手工 UI 走查
