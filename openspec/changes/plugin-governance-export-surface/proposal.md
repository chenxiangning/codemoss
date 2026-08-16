# Proposal: plugin-governance-export-surface

> OpenSpec change id: `plugin-governance-export-surface`

## Why

Governance 过渡仓只有 Manifest。Status Panel 仍直达 `src/features/governance`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-governance` MUST 再导出 runtime。
2. Status Panel 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/governance`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。
5. 当前没有独立 Governance UI，MUST NOT 发明假面板。

## Capabilities

- `plugin-governance-export-surface-v1`
