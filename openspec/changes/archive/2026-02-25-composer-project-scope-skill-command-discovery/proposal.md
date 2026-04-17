# Proposal: Composer S+/M+ Project-Scoped Skill & Command Discovery

## Why

当前 Chat 输入框的 `S+`（Skill）与 `M+`（Commons/Command）在可发现性上存在结构性缺口：

- `S+` 主要依赖现有本地/全局 skill 来源，未覆盖当前项目目录下 `.claude/skills`、`.codex/skills`。
- `M+` 当前读取链路以全局命令目录为主，未覆盖当前项目目录下 `.claude/commands`、`.codex/commands`。
- 真实用户场景中，团队会把项目专属能力（skill/command）随仓库维护；当 UI 无法读到这些能力时，`S+ / M+` 的候选列表与用户预期脱节。

这导致两个后果：

1. 项目沉淀的“就地知识”无法在聊天入口被使用，降低功能价值密度。
2. 用户需要手动输入 slash 命令或记忆路径，增加使用摩擦并导致误用。

## 目标与边界

- 目标：让 `S+ / M+` 同时发现用户级与项目级资源，并在弹层中按“来源”分组展示。
- 目标：在不破坏现有输入组装语义（`/skill /command + user input`）的前提下完成扩展。
- 目标：保持无配置可用，目录缺失时自动降级，不打断聊天流程。
- 边界：本提案只覆盖资源发现与展示，不改动 Prompt 组装规则。
- 边界：本提案不引入新的命令执行权限模型，仅扩充候选来源与展示语义。

## 非目标

- 不在本期实现远程仓库/多仓聚合扫描。
- 不在本期做 skill/command 内容编辑器。
- 不在本期改变 `S+ / M+` 按钮位置或整体视觉框架。

## What Changes

1. 新增项目级来源发现（Skill）
    - 在当前 workspace 根目录新增扫描：
        - `<workspace>/.claude/skills`
        - `<workspace>/.codex/skills`
    - 与现有来源合并，并返回来源标识（`source`）。

2. 新增项目级来源发现（Command）
    - 在当前 workspace 根目录新增扫描：
        - `<workspace>/.claude/commands`（兼容 `Commands`）
        - `<workspace>/.codex/commands`（兼容 `Commands`）
    - 与现有来源合并，并返回来源标识（`source`）。

3. 定义统一优先级与去重策略
    - 默认优先级：`workspace-managed > project > global`。
    - 同名冲突按优先级保留一项（避免同名 token 导致选择歧义）。
    - 在调试日志中回显最终来源，便于排障。

4. S+/M+ 弹层支持“来源分组”
    - 顶层按来源分组展示（示例：`Project .claude`、`Project .codex`、`User Global`）。
    - 组内继续保留现有名称前缀分组能力（如 `open-spec`、`git`、`doc`）。
    - 搜索行为保持“全量过滤”，但结果按来源分组回显。

5. 错误与降级语义
    - 当项目目录缺失/不可读时，不弹全局错误，仅跳过该来源并继续展示其它来源。
    - 当所有来源均为空时，保持现有空态提示。

## 技术方案对比与取舍

### 方案 A：仅补全局目录说明文档（不改实现）

- 优点：零研发成本。
- 缺点：无法满足“项目内就地能力可见”的核心诉求。

### 方案 B：仅后端扩源，前端仍按当前分组

- 优点：改动相对小。
- 缺点：用户无法区分来源，难以判断“当前命中的是项目规则还是全局规则”。

### 方案 C：后端扩源 + 前端来源分组（采用）

- 优点：能力可见、来源可解释、符合用户心智。
- 缺点：需要扩展前后端数据结构与 UI 渲染逻辑。

取舍：采用 C，优先保证“可发现 + 可解释”。

## Capabilities

### New Capabilities

- `composer-context-project-resource-discovery`: 在 Composer 场景发现项目级 skill/command 资源。
- `composer-context-source-grouping`: 在 `S+ / M+` 弹层按来源分组展示候选项。

## 验收标准

1. 当项目存在 `.claude/skills` 或 `.codex/skills` 时，`S+` 必须出现对应来源分组并展示条目。
2. 当项目存在 `.claude/commands` 或 `.codex/commands` 时，`M+` 必须出现对应来源分组并展示条目。
3. 当项目级与全局存在同名项时，列表中仅展示优先级最高的一项，且来源标识正确。
4. 当项目目录不存在 `.claude/.codex` 时，`S+ / M+` 仍能正常展示现有全局项，不出现阻断错误。
5. 搜索关键字命中项目级条目时，结果必须保留来源分组语义，不得退化为无分组平铺。
6. 选择项目级条目后，发送时组装行为与现有 slash 语义保持一致，不引入额外 token 污染。

## Impact

- Frontend:
    - `src/features/composer/components/Composer.tsx`（来源分组渲染）
    - `src/features/skills/hooks/useSkills.ts`（解析来源字段）
    - `src/features/commands/hooks/useCustomCommands.ts`（解析来源字段）
    - `src/types.ts`（Skill/Command option 增加来源元数据）
- Tauri/Rust:
    - `src-tauri/src/skills.rs`（项目级 skills 目录发现 + 来源标注 + 去重优先级）
    - `src-tauri/src/claude_commands.rs`（项目级 commands 目录发现 + 来源标注 + 去重优先级）
    - `src-tauri/src/codex/mod.rs`（必要时扩展 `skills_list` 返回结构）
- Test:
    - Skill/Command hook 单测新增“来源分组与去重”覆盖
    - Composer 分组渲染与搜索行为回归用例
