# Apply Plan (P0): OpenSpec-First Spec Platform

## Scope

本执行手册只覆盖 P0：

1. Foundation（1.1 ~ 1.4）
2. OpenSpec Adapter（2.1 ~ 2.4）
3. Spec Hub UI 核心壳与联动（3.1 ~ 3.5）

不包含：

- Environment Doctor（P1）
- spec-kit minimal hook（P2）
- 发布准备（P1）

## Execution Order

## 1. Runtime Foundation

- [ ] 1.1 建立统一领域类型：`SpecWorkspace/SpecChange/SpecArtifact/SpecAction`
    - 产出：类型定义 + 注释 + provider/supportLevel 枚举
    - 验收：TypeScript 类型检查通过
- [ ] 1.2 实现 provider 检测（OpenSpec full / spec-kit minimal）
    - 产出：`detectWorkspaceProvider()` 与返回结构
    - 验收：给定样例目录可稳定识别
- [ ] 1.3 实现 change/artifact 扫描器
    - 产出：`listChanges()` + `getArtifacts(changeId)`
    - 验收：能完整枚举 proposal/design/spec/tasks/verification
- [ ] 1.4 实现状态机计算器
    - 产出：`computeChangeStatus()`，含 `blocked` 原因数组
    - 验收：快照测试覆盖 draft/ready/implementing/verified/archived/blocked

## 2. OpenSpec Adapter

- [ ] 2.1 封装命令执行器（list/status/validate/action）
    - 产出：统一命令执行层，返回 `success/output/error`
    - 验收：成功/失败路径结构化返回一致
- [ ] 2.2 映射 OpenSpec artifacts 到统一模型
    - 产出：proposal/design/spec/tasks/verification 映射函数
    - 验收：样例 change 映射正确，缺失项能报空态
- [ ] 2.3 动作可用性前置检查
    - 产出：`getActionAvailability()` + blockers
    - 验收：缺失前置条件时 action 禁用并展示原因
- [ ] 2.4 strict validate 结果结构化
    - 产出：可供 UI 渲染的失败项模型（target/reason/hint）
    - 验收：校验失败可定位到 change/spec

## 3. Spec Hub UI Core

- [ ] 3.1 落地四区布局（Changes / Artifacts / Action Rail / Timeline 占位）
    - 产出：页面壳 + 状态容器
    - 验收：切换 change 时四区上下文一致
- [ ] 3.2 接入 change 列表与状态筛选
    - 产出：Active/Blocked/Archived 过滤
    - 验收：筛选无闪烁，状态标签正确
- [ ] 3.3 接入 artifact tabs（只读优先）
    - 产出：Proposal/Design/Specs/Tasks/Verification tabs
    - 验收：缺失 artifact 显示明确空态
- [ ] 3.4 接入 Action Rail
    - 产出：命令预览、blockers、执行按钮、执行结果区
    - 验收：执行后状态刷新与结果一致
- [ ] 3.5 接入 validation panel
    - 产出：结构化错误列表 + 跳转
    - 验收：失败项可一键定位

## UI Alignment Guardrails (P0 必守)

1. MUST 复用系统设计令牌（spacing/radius/color/elevation/typography）
2. MUST 复用已有 list/panel/button/tag/tooltip 组件模式
3. MUST 对状态与动作使用 icon + label（不是纯文字）
4. MUST 保证键盘可达与 tooltip 可读（禁止只靠颜色表达）

## Definition of Done (P0)

1. `tasks.md` 中 1.x/2.x/3.1~3.5 对应实现完成并可演示。
2. OpenSpec change 在 UI 里可实现最小闭环：浏览 -> 执行动作 -> 查看验证。
3. 严格校验命令通过：

```bash
openspec validate codemoss-spec-platform-integration-2026-02-22 --strict
```

4. 最小回归通过（由主工程执行）：

- TypeScript typecheck
- 相关单测（runtime/status/action/ui）
- 手工 smoke：至少 1 个 OpenSpec workspace 真实演示

## Suggested Slice Plan (3 sessions)

1. Session A: 1.1~1.4 + 2.2（模型、扫描、状态）
2. Session B: 2.1/2.3/2.4 + 3.1/3.2（动作执行与列表联动）
3. Session C: 3.3/3.4/3.5（artifact tabs + action rail + validation panel）

