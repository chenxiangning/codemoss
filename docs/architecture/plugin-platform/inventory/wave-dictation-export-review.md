# Wave Dictation Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-dictation-export-surface`  
> 结论：**方向正确。App 控制器改走 `@mossx/plugin-dictation/runtime`。** `DictationWaveform` 从 `/ui` 再导出，当前没有产品导入。实现仍在 `src/features/dictation`。未激活 Host。

## 证明

- `openspec validate plugin-dictation-export-surface --strict --no-interactive`
- vitest 包出口 + model hook：4 passed
