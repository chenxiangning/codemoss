# Proposal: plugin-skills-export-surface

> OpenSpec change id: `plugin-skills-export-surface`

## Why

Skills 过渡仓只有 Manifest。AppShell / Composer / Settings 仍直达 `src/features/skills` 与 `src/features/curated-skills`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-skills` MUST 再导出 runtime / ui。
2. AppShell、Composer、Settings 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/skills` 与 `src/features/curated-skills`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。

## Capabilities

- `plugin-skills-export-surface-v1`
