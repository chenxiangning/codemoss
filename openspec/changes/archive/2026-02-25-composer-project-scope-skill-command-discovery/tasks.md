## 1. Rust Discovery and API Shape

- [x] 1.1 扩展 `SkillEntry` 返回结构，增加 `source` 字段并保持旧字段兼容。
- [x] 1.2 在 `skills.rs` 增加项目级目录扫描：`<workspace>/.claude/skills` 与 `<workspace>/.codex/skills`。
- [x] 1.3 在 `skills.rs` 实现技能来源优先级去重：
  `workspace_managed > project_claude > project_codex > global_claude > global_codex`。
- [x] 1.4 扩展 `ClaudeCommandEntry` 返回结构，增加 `source` 字段并保持旧字段兼容。
- [x] 1.5 在 `claude_commands.rs` 增加项目级命令扫描：`.claude/.codex` 下 `commands/Commands`。
- [x] 1.6 在命令扫描中实现来源优先级去重：`project_claude > project_codex > global_claude`。
- [x] 1.7 为目录缺失、权限不足、单文件解析失败补充非阻断降级与 warning 日志。

## 2. Frontend Data Normalization

- [x] 2.1 扩展 `SkillOption` 与 `CustomCommandOption` 类型，增加 `source` 元数据。
- [x] 2.2 在 `useSkills` 中归一化并透传 `source` 字段，保留旧返回兼容路径。
- [x] 2.3 在 `useCustomCommands` 中归一化并透传 `source` 字段，保留旧返回兼容路径。
- [x] 2.4 为来源字段缺失场景提供前端安全回退值，避免渲染空分组。

## 3. Composer S+/M+ Grouped Rendering

- [x] 3.1 在 `Composer.tsx` 增加“来源分组”模型，作为现有前缀分组的上层维度。
- [x] 3.2 改造 `S+` 弹层渲染：先按来源分组，再按名称前缀分组。
- [x] 3.3 改造 `M+` 弹层渲染：先按来源分组，再按名称前缀分组。
- [x] 3.4 接入搜索过滤后的分组重建逻辑，确保匹配结果仍保留来源语义。
- [x] 3.5 隐藏搜索后的空来源分组并保持现有空态提示一致。
- [x] 3.6 验证选择项目级条目后 prompt 组装行为不变（仅 `/name` token，无 source 文本）。

## 4. Automated Tests

- [x] 4.1 为 `skills.rs` 增加项目级扫描、来源标注、优先级去重测试。
- [x] 4.2 为 `claude_commands.rs` 增加项目级扫描、`commands/Commands` 兼容、优先级去重测试。
- [x] 4.3 为 `useSkills.test.tsx` 增加来源字段归一化与缺省回退测试。
- [x] 4.4 为 `useCustomCommands.test.tsx` 增加来源字段归一化与缺省回退测试。
- [x] 4.5 为 Composer 选择器增加来源分组渲染测试（S+ 与 M+）。
- [x] 4.6 为 Composer 搜索增加“过滤后仍按来源分组”测试。
- [x] 4.7 为 prompt 组装增加回归测试，确认来源分组不改变 slash token 语义。

## 5. Validation and Delivery

- [x] 5.1 运行并通过目标测试集（Rust + Vitest 增量用例）。
- [x] 5.2 运行并通过 `npm run typecheck` 与 `npm run lint`。
- [x] 5.3 执行 `openspec validate --change composer-project-scope-skill-command-discovery` 并修复校验问题。
