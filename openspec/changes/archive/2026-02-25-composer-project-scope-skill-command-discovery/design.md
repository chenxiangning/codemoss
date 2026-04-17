## Context

当前 `S+ / M+` 的候选来源与用户在项目中的实际组织方式存在偏差：

- `S+` 读取链路聚焦于 workspace-managed 与 global skill。
- `M+` 读取链路聚焦于 global commands。
- 项目根目录下 `.claude/.codex` 的 `skills/commands` 未进入统一发现链路。

在真实项目中，团队通常把项目级规则随仓库维护（如 `.claude/skills/*/SKILL.md`、`.claude/commands/**/*.md`）。
如果 `S+ / M+` 不读取这些目录，用户会看到“功能存在于项目，但入口不可选”的断裂体验。

本变更涉及 Rust 扫描层、Tauri 返回结构、前端 Hook 归一化与 Composer 分组渲染，属于跨模块改动。

## Goals / Non-Goals

**Goals:**

- 将项目级 `skills/commands` 纳入 `S+ / M+` 候选发现范围。
- 为每个候选返回可解释的 `source` 元信息。
- 在 `S+ / M+` 弹层中按来源分组展示，保持搜索可用。
- 建立确定性的去重优先级，避免同名项重复或歧义。
- 对目录缺失、权限不足等情况实现无阻断降级。

**Non-Goals:**

- 不改 slash prompt 组装语义与发送协议。
- 不引入跨仓库扫描或远程目录发现。
- 不在本期实现项目级 skill/command 编辑能力。

## Decisions

### Decision 1: 引入统一来源模型（source metadata）

- 方案 A：前端根据 path 猜来源。
- 方案 B：后端扫描时显式标注 `source`，前端直用。**（采用）**

**原因**：来源解释属于数据语义，不应让前端通过 path 字符串推断；后端标注更稳定且可测试。

建议来源值（枚举语义）：

- skill: `workspace_managed | project_claude | project_codex | global_claude | global_codex`
- command: `project_claude | project_codex | global_claude`

### Decision 2: 项目级目录采用“约定优先 + 大小写兼容”

- skills:
    - `<workspace>/.claude/skills`
    - `<workspace>/.codex/skills`
- commands:
    - `<workspace>/.claude/commands` 与 `<workspace>/.claude/Commands`
    - `<workspace>/.codex/commands` 与 `<workspace>/.codex/Commands`

**原因**：兼容现有生态中 `commands/Commands` 混用现象，减少“目录存在但扫不到”的误报。

### Decision 3: 去重采用“来源优先级 first-win”

- skills 优先级：`workspace_managed > project_claude > project_codex > global_claude > global_codex`
- commands 优先级：`project_claude > project_codex > global_claude`

实现方式：按优先级顺序拼接来源集合，再按规范化 name 去重（first-win）。

**原因**：符合“项目就近覆盖全局”的用户心智，同时保留 managed skill 最高优先权。

### Decision 4: UI 分组采用“来源分组 + 前缀子分组”

- 一级：来源分组（Project .claude / Project .codex / User Global / Managed）
- 二级：沿用现有前缀分组逻辑（`open-spec:*`, `git-*` 等）

**原因**：来源是用户决策第一维度，前缀是内容组织维度，两者叠加可以兼顾可解释性与扫描效率。

### Decision 5: 错误处理采用“来源局部降级，不阻断弹层”

- 任一来源目录不存在、不可读、单文件解析失败时，仅跳过该来源或该文件。
- 继续返回其它来源结果，并在调试日志追加来源级告警。

**原因**：`S+ / M+` 是增强能力，不能因单来源异常导致主对话流程不可用。

## Risks / Trade-offs

- [Risk] 来源维度增加后 UI 信息密度上升  
  Mitigation: 默认折叠空分组，仅显示有结果分组。

- [Risk] 同名去重可能隐藏用户期望条目  
  Mitigation: 在调试日志输出“去重命中来源与被覆盖来源”。

- [Risk] 扫描来源增加可能引入性能抖动  
  Mitigation: 复用现有单层目录扫描策略，限制读取大小并保持按需 refresh。

- [Risk] 项目目录结构差异（软链/权限）导致行为不一致  
  Mitigation: 保持 symlink 跳过策略，权限失败返回可观测 warning。

## Migration Plan

1. 扩展 Rust 扫描层返回结构，新增 `source` 字段并补齐去重逻辑。
2. 扩展前端类型与 Hook 归一化逻辑，透传 `source`。
3. 改造 Composer `S+ / M+` 渲染：来源分组 + 搜索联动。
4. 补充测试（Rust 扫描、Hook 归一化、Composer 渲染与搜索）。
5. 运行 `openspec validate --change composer-project-scope-skill-command-discovery`。

Rollback:

- 保留字段向后兼容（`source` 可选），回滚时前端可退回旧分组而不影响现有数据结构。

## Open Questions

1. `M+` 是否需要后续支持 workspace-managed commands（与 skill 的 managed 概念对齐）？
2. 来源分组标题是否需要 i18n key（当前提案仅定义语义，不限制文案实现）？
