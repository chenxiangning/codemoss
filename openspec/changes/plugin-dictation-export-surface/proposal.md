# Proposal: plugin-dictation-export-surface

> OpenSpec change id: `plugin-dictation-export-surface`

## Why

Dictation 过渡仓只有 Manifest。App 控制器仍直达 `src/features/dictation`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-dictation` MUST 再导出 runtime / ui。
2. App 控制器生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/dictation`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。
5. `DictationWaveform` 当前没有产品导入，仍 MUST 从 `/ui` 再导出，供后续插拔。

## Capabilities

- `plugin-dictation-export-surface-v1`
