# Verification: spec-hub-speckit-openspec-isolation-audit-2026-02-25

## Scope

本次仅执行“第一阶段基线审计”，覆盖：

- Scope 与入口盘点（provider / adapter / runtime state）
- 独立性基线清单
- legacy 非侵入基线清单
- 冲突前能力矩阵（初版）

不覆盖最终门禁结论（Pass / Blocked Final）。

## Test Environment

- Date: 2026-02-25
- Auditor: Codex (GPT-5)
- Main repo: `codex-fix-one-v0.1.9`
- Spec repo: `codemoss-openspec`
- Change: `spec-hub-speckit-openspec-isolation-audit-2026-02-25`

## Command Evidence (Summary)

### 1) Provider Scope 与运行态分区证据

Command:

```bash
rg -n "providerScopeKey|timelineByScopeRef|applyExecutionByScopeRef|Provider mismatch: native action requires openspec" \
  src/features/spec/hooks/useSpecHub.ts
```

Result:

- `providerScopeKey(workspaceId, provider)` 存在，格式为 `workspaceId:provider`
- timeline/applyExecution 按 scope 分桶读写
- 非 openspec 触发 native action 会 fail-fast 报 mismatch

### 2) Provider 路由与命令分流证据

Command:

```bash
rg -n "buildActionCommand\\(|buildActionCommandArgs\\(|provider === \"speckit\"|provider === \"openspec\"" \
  src/lib/spec-core/runtime.ts
```

Result:

- `buildActionCommand*` 按 provider 分流
- `speckit` 走 `specify ... --help` 路径
- `openspec` 走 `openspec instructions/validate/archive` 路径

### 3) 模块边界现状证据

Command:

```bash
[ -d src/features/spec/providers ] && echo present || echo absent
```

Result:

- `src/features/spec/providers` 当前为 `absent`
- 说明独立 provider 模块目录尚未落地（对应主提案 10.6 / 11.4 仍待完成）

### 4) 主提案依赖完成度证据

Command:

```bash
rg -n "\\[x\\].*10\\.[1-9]|\\[ \\].*10\\.[1-9]|\\[ \\].*11\\.[1-9]" \
  /Users/chenxiangning/code/AI/github/codemoss-openspec/openspec/changes/spec-hub-speckit-module-2026-02-25/tasks.md
```

Result:

- 已完成：10.1 ~ 10.5
- 未完成：10.6 ~ 10.10，11.1 ~ 11.7

## Baseline Checklists

### A) 独立性基线清单（第一版）

- Scope key: `workspaceId:provider`（已建立）
- State 容器：run/timeline/applyExecution 按 provider scope 分区（已建立）
- Dispatch 路由：按 provider 选择 action command（已建立）
- 写保护：目前仅见 native action provider mismatch 防护；跨 provider mutation 写保护未形成完整闭环（待补）

### B) Legacy 非侵入基线清单（第一版）

允许修改（wiring 优先）：

- `src/features/spec/hooks/useSpecHub.ts`
- `src/features/spec/components/SpecHub.tsx`
- `src/lib/spec-core/runtime.ts`
- `src/services/tauri.ts`

禁止侵入（未完成前作为红线）：

- 不在 OpenSpec legacy 主流程内继续扩散 spec-kit 专属分支
- 不使用整文件覆盖方式解决冲突（`--ours/--theirs`）
- 不在业务流程散落平台特判（应收敛到 platform adapter）

目标新增边界（当前尚未落地）：

- `src/features/spec/providers/speckit/**`
- `src/features/spec/providers/shared/platform/**`

## Pre-Merge Capability Matrix (OpenSpec vs spec-kit)

| 能力点                  | OpenSpec 链路                              | spec-kit 链路                                  | 当前判定             |
|----------------------|------------------------------------------|----------------------------------------------|------------------|
| Action 命令分流          | `openspec instructions/validate/archive` | `specify propose/tasks/check/archive --help` | 双侧符号存在           |
| Provider 运行态分区       | `workspaceId:openspec`                   | `workspaceId:speckit`                        | 已按 scope 分桶      |
| Native 执行入口防串        | 非 openspec 拒绝 native                     | -                                            | 已有 fail-fast     |
| Adapter registry 独立化 | 待完善                                      | 待完善                                          | Blocked（依赖 10.6） |
| 跨 provider 写保护       | 待完善                                      | 待完善                                          | Blocked（依赖 10.7） |
| 独立 provider 目录       | 待落地                                      | 待落地                                          | Blocked（依赖 11.4） |

## Blocked Items and Recommendations

### Blocked-1: adapter registry 尚未独立

- Risk: 请求可能仍共享路由表，存在串路由风险
- Action: 完成主提案 `10.6`

### Blocked-2: 跨 provider mutation 写保护未闭环

- Risk: 存在状态互写可能
- Action: 完成主提案 `10.7`，并补回归测试 `10.10`

### Blocked-3: 独立模块目录与 platform adapter 未落地

- Risk: legacy 文件持续承载新逻辑，冲突面扩大
- Action: 完成主提案 `11.1 ~ 11.4`

## Phase Conclusion

- Current Stage Result: `Blocked (Interim)`
- Meaning: 基线已建立，可继续开发；但不满足最终发布门禁
- Next Gate Trigger:
    - 主提案至少完成 `10.6 + 10.7 + 11.1 + 11.4`
    - 之后执行本提案 2.x / 3.2~3.4 / 4.3 / 5.x 的最终验收

## Gate Snapshot (2026-02-27)

- Final Gate Status (as-of snapshot): `Blocked`
- Blocked Reason:
  - `spec-hub-speckit-module-2026-02-25` 的关键依赖任务未完成（`10.6`, `10.7`, `11.1`, `11.4`）
  - 本提案 2.x / 3.2~3.4 / 4.3 / 5.x 的最终验证链路尚未具备执行前提
- Release Decision:
  - 本提案维持活跃但冻结在 `verification/blocked` 状态
  - 待依赖完成后恢复执行并更新最终 `Pass / Blocked` 结论

## OpenSpec Validation

Command:

```bash
openspec validate spec-hub-speckit-openspec-isolation-audit-2026-02-25 --strict
```

Result:

- Status: `[x] Passed`
- Output: `Change 'spec-hub-speckit-openspec-isolation-audit-2026-02-25' is valid`
