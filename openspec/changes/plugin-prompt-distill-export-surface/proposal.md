# Proposal: plugin-prompt-distill-export-surface

> OpenSpec change id: `plugin-prompt-distill-export-surface`

## Why

Prompt Distill 过渡仓只有 Manifest。Messages 仍直达 `src/features/prompt-distill`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-prompt-distill` MUST 再导出 runtime / ui。
2. Messages 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/prompt-distill`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。

## Capabilities

- `plugin-prompt-distill-export-surface-v1`
