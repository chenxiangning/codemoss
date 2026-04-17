## 1. Foundation: 统一模型与目录接入（P0）

- [x] 1.1 定义 `SpecWorkspace/SpecChange/SpecArtifact/SpecAction` 统一类型（输入：proposal/design；输出：类型定义与注释）
- [x] 1.2 实现 workspace provider 检测（OpenSpec 主路径 + spec-kit 识别位）(depends on: 1.1)（验证：同一路径可稳定识别
  provider）
- [x] 1.3 实现 change 与 artifact 文件扫描器 (depends on: 1.1)（验证：可列出 change 与各 artifact 存在状态）
- [x] 1.4 实现统一状态机计算器（draft/ready/implementing/verified/archived/blocked）(depends on: 1.3)（验证：状态判定快照测试通过）

## 2. OpenSpec Adapter（P0）

- [x] 2.1 封装 OpenSpec 基础命令执行器（list/status/validate/action）(depends on: 1.2)（验证：命令成功与失败路径均可回传结构化结果）
- [x] 2.2 实现 OpenSpec artifact 映射（proposal/design/spec/tasks/verification）(depends on: 1.3)（验证：样例 change 映射正确）
- [x] 2.3 接入 OpenSpec action 可用性判定（continue/apply/verify/archive）(depends on: 2.1, 2.2)（验证：缺失前置条件时
  blockers 正确展示）
- [x] 2.4 实现 OpenSpec validate 结果结构化展示模型 (depends on: 2.1)（验证：严格校验失败可定位到 change 与原因）

## 3. Spec Hub UI（P0）

- [x] 3.1 新增 Spec Hub 页面壳（左 Changes / 中 Artifacts / 右 Action Rail / 底 Timeline）(depends on: 1.4)
- [x] 3.2 接入 change 列表与状态筛选（Active/Blocked/Archived）(depends on: 3.1)（验证：筛选与切换无闪烁）
- [x] 3.3 接入 artifact tabs 展示与编辑入口（只读优先）(depends on: 3.1, 2.2)（验证：artifact 缺失时有明确空态）
- [x] 3.4 接入 Action Rail（命令预览 + blockers + 执行结果）(depends on: 2.3, 3.1)（验证：执行结果与状态刷新一致）
- [x] 3.5 接入 validation panel（结构化错误 + 跳转）(depends on: 2.4, 3.4)（验证：失败项可一键定位）
- [x] 3.6 建立状态/动作/风险 icon 语义映射并接入 UI（depends on: 3.2, 3.4）（验证：主要状态与动作均有 icon + label）
- [x] 3.7 完成 Spec Hub 与主系统视觉令牌对齐（spacing/color/elevation/typography）(depends on: 3.1)（验证：设计走查通过）

## 4. Environment Doctor 与双模式（P1）

- [x] 4.1 设计并实现环境健康探测（OpenSpec 必需: Node + openspec；spec-kit 仅探测）(depends on: 1.2)（验证：缺失依赖可分类显示）
- [x] 4.2 提供 Managed/BYO 模式选择与持久化（workspace 级）(depends on: 4.1)（验证：重启后模式保持一致）
- [x] 4.3 Managed 模式安装引导与失败恢复（OpenSpec 主路径）(depends on: 4.2)（验证：失败后可回退 BYO）
- [x] 4.4 BYO 模式路径与版本诊断展示 (depends on: 4.2)（验证：命令路径与版本准确）

## 5. spec-kit 最小兼容口子（P2，可选）

- [x] 5.1 实现 spec-kit workspace detect + support-level 标记（minimal）(depends on: 1.2)
- [x] 5.2 提供 spec-kit read-only artifact 浏览映射（不可映射项走 metadata）(depends on: 5.1)（验证：UI 不崩溃且差异可见）
- [x] 5.3 提供外部命令/文档跳转入口（passthrough，不做完整动作语义）(depends on: 5.1)（验证：用户可从 UI 一键跳转）
- [x] 5.4 provider 差异提示与降级策略（明确“最小兼容”边界）(depends on: 5.2, 5.3)（验证：不支持动作时给明确提示）

## 6. Traceability 与门禁（P1）

- [x] 6.1 设计 timeline event schema（spec action / validate / git link）(depends on: 3.1)
- [x] 6.2 接入 action 与 validate 事件写入时间线 (depends on: 3.4, 3.5, 6.1)
- [x] 6.3 定义 Spec Hub 最小门禁（provider health + artifact completeness + validation）(depends on: 6.2)（验证：门禁状态可复现）
- [x] 6.4 补充最小回归测试矩阵（OpenSpec 主路径 + spec-kit smoke）(depends on: 6.3)
- [x] 6.5 增加 UI 一致性门禁（icon 覆盖率、主题可读性、键盘可达性）(depends on: 3.6, 3.7)（验证：门禁报告可追溯）

## 7. 发布准备（P1）

- [x] 7.1 输出用户指南（首次接入、模式切换、常见失败修复）
- [x] 7.2 输出运维与支持手册（诊断信息采集、日志路径、升级建议）
- [x] 7.3 执行 typecheck/test/关键路径手工验收并记录
- [x] 7.4 验收通过后推进归档（verify -> archive）
- [x] 7.5 执行 UI 统一性验收（与现有系统页面并排走查 + icon 语义抽检）
