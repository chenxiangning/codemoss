## Why

第一轮治理已将 `>3000` 文件清零并启用 hard gate。  
基于当前收益评估，Wave2 批量预防性拆分暂不执行，转为 Deferred + JIT（Just-In-Time）策略：仅在触线时进行同 PR 拆分治理。

## What Changes

- 暂缓 Wave2 批量近阈值拆分，不再要求 `2500-3000` 必做治理。
- 明确 JIT 拆分规则：当 PR 导致任一文件 `>3000` 时，必须在同一 PR 内完成降线（拆分或抽取模块）后再合并。
- 保留现有 `>3000` hard gate，作为唯一强制门禁。
- 可选维护 near-threshold 观察清单（信息性，不阻断、不强制 OpenSpec 计划引用）。

## Capabilities

### Modified Capabilities

- `large-file-modularization-governance`: 从“双阈值预防治理”调整为“`>3000` hard gate + 触线 JIT 拆分”。

## Impact

- Affected code:
  - 本提案当前仅调整治理策略与流程，不直接提交批量代码拆分。
  - 近阈值文件维持观察状态，触发 `>3000` 时按 JIT 原则处理。

## Guardrails

- 不改变对外 API/命令协议。
- 触线拆分必须同 PR 通过 typecheck + 目标模块测试 + Rust compile。
- 拆分遵循 facade 兼容策略，避免一次性重写。
