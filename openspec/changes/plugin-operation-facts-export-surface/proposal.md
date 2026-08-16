# Proposal: plugin-operation-facts-export-surface

> OpenSpec change id: `plugin-operation-facts-export-surface`

## Why

Operation Facts 过渡仓只有 Manifest。Status / Composer / session-activity 仍直达 `src/features/operation-facts`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-operation-facts` MUST 再导出 runtime。
2. Status、Composer、session-activity 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/operation-facts`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。
5. 当前没有独立 UI 面板，MUST NOT 发明假面板。

## Capabilities

- `plugin-operation-facts-export-surface-v1`
