# Proposal: plugin-computer-use-export-surface

> OpenSpec change id: `plugin-computer-use-export-surface`

## Why

Computer Use 过渡仓只有 Manifest。Settings 仍直达 `src/features/computer-use`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-computer-use` MUST 再导出 runtime / ui。
2. Settings 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/computer-use`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。

## Capabilities

- `plugin-computer-use-export-surface-v1`
