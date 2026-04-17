## Why

`worktree-explicit-base-selection` 首版归档后，曾遗留 8 个任务未收口，主要集中在错误文案一致性、发布状态可见性、失败补救提示、Gemini
可用性标识与发布门禁记录。  
本 follow-up 变更已在 **2026-02-20** 完成 8/8 项收口，当前提案作为归档前的“变更闭环记录”。

## 目标与边界

- 目标
    - 补齐创建工作树失败态文案映射，确保“错误可读、可定位、可补救”。
    - 补齐 `publishToOrigin` 的结果展示（成功 tracking/失败原因/重试命令）。
    - 为 `Gemini` 入口增加明确禁用态与原因说明（未开放）。
    - 完成本变更所需的验证与发布门禁文档化收口。
- 边界
    - 不重做已归档能力本身（显式 baseRef、双栏弹窗、统一 `+` 菜单）。
    - 不新增新的 Git 流程能力（如自动 PR / 自动 rebase 编排）。
    - 不扩展到其他模块（仅工作树创建链路与工作区 `+` 菜单）。

## 非目标

- 不调整工作树底层数据模型。
- 不改动远端策略（仍仅 `origin` 自动发布）。
- 不新增新的引擎入口（仅完善现有 Gemini 未开放反馈）。

## What Changes

- 完善工作树创建错误映射：无效基线、目录冲突、分支名非法等场景统一 i18n 与展示语义。
- 完善创建后发布结果区：
    - 成功时显示 `origin/<branch>` tracking 结果。
    - 失败时显示可读原因与重试命令。
- 对“本地创建成功但 push 失败”场景增加明确可恢复提示，不误导用户为“整体失败”。
- 在 `+` 菜单中将 `Gemini` 入口显示为禁用并附加 `(未开放)` 说明。
- 补齐回归与发布门禁：
    - 关键回归测试执行记录。
    - `openspec validate ... --strict` 记录。
    - 发布 checklist（风险、回滚、观测指标）。

## 技术方案对比

### 方案 A：保持现状（只做零散修补）

- 优点：短期改动小。
- 缺点：缺少统一验收与门禁，问题容易重复出现。
- 结论：不采纳。

### 方案 B：建立 Follow-up Change（本提案）

- 优点：8 个遗留项可追踪、可验证、可归档；与 OpenSpec 流程一致。
- 缺点：需要补 proposal/design/spec/tasks 文档。
- 结论：采纳。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `git-worktree-base-selection`: 补充错误可读性、发布结果可见性、失败补救提示与未开放入口可用性反馈要求。

## Impact

- 前端
    - 工作树创建失败文案映射与结果展示组件。
    - 工作区 `+` 菜单中 `Gemini` 禁用态展示。
- 后端/接口
    - 复用现有返回结构，补齐前端解析与展示，不新增协议字段。
- 测试与交付
    - 回归测试、严格校验、发布 checklist 补齐。

## 验收标准

- 用户在创建工作树失败时可看到稳定且可读的错误提示（含场景归因）。
- `publishToOrigin` 成功时可见 tracking 结果，失败时可见补救命令。
- “本地成功 + 远端失败”必须明确为可恢复状态。
- `Gemini` 在 `+` 菜单中为禁用态，并显示“未开放”说明。
- 本变更补齐的自动化测试与发布 checklist 可复核、可追溯。

## 当前状态（2026-02-20）

- 任务完成度：`8/8`（见 `tasks.md` 全量勾选）。
- 验证状态：
    - `openspec validate worktree-explicit-base-selection-followup --strict` 通过。
    - 关键回归（worktree prompt / sidebar menu / workspace actions / git history）通过。
    - `typecheck` 通过。
- 发布门禁记录：已落地 `release-checklist.md`，包含已知风险、回滚方案与自动发布观测门禁（push 成功率、鉴权失败率、补救命令可用性）。

## 归档建议

- 当前变更满足归档前置条件，可进入 `openspec-archive-change` 阶段。
