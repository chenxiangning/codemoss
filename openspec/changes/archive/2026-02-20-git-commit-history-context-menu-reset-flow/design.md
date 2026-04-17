## Context

当前 `git-commit-history` 已有基础 context menu，但只覆盖复制 hash/message、create
branch、cherry-pick、revert，未定义“重置到此提交”的完整交互与风险边界。用户给出的图2/图3明确了新目标：提交项右键要成为高频入口，并将
reset 的确认流程产品化。

该变更跨越三个层面：

- 提交列表交互层（右键菜单分组与排序）
- 提交区动作层（关联按钮组）
- Git 写操作层（reset 模式执行与并发安全）

## Goals / Non-Goals

**Goals:**

- 建立统一 action registry，让右键菜单和按钮组共享同一动作定义。
- 将 `reset to commit` 设计为“先确认后执行”的状态机，完整覆盖 `soft/mixed/hard/keep`。
- 在写操作并发时提供一致的禁用与提示策略。

**Non-Goals:**

- 不重构历史列表虚拟滚动与分页。
- 不实现 interactive rebase/fixup/squash 等高级历史改写。
- 不改变现有 Git provider 架构。

## Decisions

### Decision 1: 使用统一 Action Registry 关联右键菜单与按钮组

- 决策
    - 采用 `CommitActionRegistry`（前端单一注册源）定义 action id、分组、排序、visible/disabled 规则、executor。
- 理由
    - 解决“右键一套逻辑、按钮一套逻辑”的漂移问题。
    - 可直接做 snapshot/矩阵测试，降低回归成本。
- 备选
    - 菜单与按钮分别维护：实现快但长期不可维护，不采纳。

### Decision 2: Reset 采用两阶段确认状态机

- 决策
    - 第一阶段：从菜单/按钮触发，打开 reset dialog，不执行命令。
    - 第二阶段：用户选择模式并确认后才执行。
- 理由
    - reset 为高风险写操作，必须显式确认。
    - 便于挂载模式解释、危险提示、错误恢复入口。
- 备选
    - 直接执行 mixed reset：速度快但风险不可控，不采纳。

### Decision 3: 模式语义与默认值

- 决策
    - 支持 `soft/mixed/hard/keep`，默认 `mixed`。
    - `hard` 追加破坏性警示文案。
- 理由
    - 与 Git 主流心智一致，避免自定义语义。
    - 默认 mixed 在“重置索引/保留工作区”之间平衡风险与实用性。
- 备选
    - 仅开放 mixed/hard：功能不完整，不满足图3。

### Decision 4: 并发锁策略复用 git-operations 全局写锁

- 决策
    - reset 纳入与 pull/push/sync/cherry-pick/revert 同级的互斥写操作集合。
- 理由
    - 避免并发写导致仓库状态不一致。
    - 与既有用户心智保持一致。
- 备选
    - reset 独立执行：短期可行但冲突风险高，不采纳。

### Decision 5: 错误反馈统一映射为可读业务文案

- 决策
    - 后端错误码映射为固定用户文案（冲突、脏工作区限制、权限/锁失败），并保留 `Retry`。
- 理由
    - Git 原始 stderr 可读性差，直接透传影响 UX。
- 备选
    - 全量透传 stderr：排障强但用户体验差，不采纳。

## Risks / Trade-offs

- [Risk] 动作过多造成菜单冗长 -> Mitigation: 分组+固定顺序，P0 仅强约束两条主链路。
- [Risk] reset 语义被误解 -> Mitigation: 弹窗内置模式解释+hard 警示。
- [Risk] 并发状态判断与实际执行窗口存在时间差 -> Mitigation: 后端执行前二次校验仓库状态。
- [Risk] 按钮组与菜单状态不一致 -> Mitigation: 强制走同一 registry 与同一 guard 函数。

## Migration Plan

1. 建立 `CommitActionRegistry` 并接入右键菜单渲染。
2. 接入提交区按钮组，复用同一 registry。
3. 落地 reset dialog 与模式说明。
4. 接入后端 reset 执行与错误映射。
5. 纳入全局写锁禁用逻辑，补齐自动化测试。
6. 灰度验证后全量启用。

回滚策略：

- 保留 feature flag，一键回退到“仅旧菜单动作，不暴露 reset”。
- 回滚不涉及数据迁移，低风险。

## Open Questions

- `keep` 模式在脏工作区冲突时，文案是否需要额外“建议先 stash”引导？
- 按钮组是否需要支持快捷键提示（本提案先不纳入实现）。
