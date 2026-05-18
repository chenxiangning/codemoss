## 1. Core Policy Adapter (Behavior-Equivalent Contract)

- [x] 1.1 [P0][depends:none][I: `src/features/status-panel/utils/checkpoint.ts`][O: 现有判决逻辑分解清单][V: 每个判决分支可被映射到 PolicyDecision] inventory 现有 checkpoint 判决路径。
- [x] 1.2 [P0][depends:1.1][I: 现有判决路径][O: `policies/policyTypes.ts`][V: `Policy` / `PolicyDecision` 接口完整] 定义 policy 接口类型。
- [x] 1.3 [P0][depends:1.2][I: 现有判决逻辑][O: `policies/corePolicy.ts` adapter][V: 通过现有 checkpoint verdict 适配为 PolicyDecision；未替换 runtime 主路径] 抽取 corePolicy adapter。
- [x] 1.4 [P0][depends:1.3][I: 现有 `checkpoint.test.ts`][O: 测试全绿][V: 现有断言 0 regression] 验证行为等价。

## 2. Policy Registry & Chain Composition

- [x] 2.1 [P0][depends:1.2][I: policy types][O: `policies/policyRegistry.ts`][V: register / unregister / list API + 默认包含 corePolicy] 实现 registry。
- [x] 2.2 [P0][depends:2.1][I: registry][O: chain 组合函数][V: most-severe-wins + tie 保留原始顺序] 实现 chain composition。
- [x] 2.3 [P0][depends:2.2][I: chain 组合][O: `policyRegistry.test.ts`][V: 覆盖 most-severe / tie / no_contribution 三类] chain 行为单测。
- [x] 2.4 [P0][depends:2.2][I: 现有 evidence 结构][O: audit trail buffer][V: 环形缓冲 50 条；不写盘] 实现 audit trail buffer。
- [x] 2.5 [P0][depends:2.4][I: audit buffer][O: 单测][V: FIFO 截断 / 不写盘断言] audit buffer 单测。

## 3. First-Batch Policies (Plug-Ins Over Existing Validation Evidence)

- [x] 3.1 [P0][depends:2.1][I: `CheckpointValidationEvidence`][O: `lintValidationPolicy.ts`][V: 消费 `validations[].kind === 'lint'`；contribution ≤ `needs_review`] 实现 lint policy。
- [x] 3.2 [P0][depends:2.1][I: `CheckpointValidationEvidence`][O: `typecheckValidationPolicy.ts`][V: 消费 `validations[].kind === 'typecheck'`；contribution ≤ `needs_review`] 实现 typecheck policy。
- [x] 3.3 [P0][depends:2.1][I: `CheckpointValidationEvidence`][O: `testsValidationPolicy.ts`][V: 消费 `validations[].kind === 'tests'`；contribution ≤ `needs_review`] 实现 tests policy。
- [x] 3.4 [P0][depends:3.1,3.2,3.3][I: 三类 policy][O: 单测][V: pass / fail / running / not_run / not_observed 五态全覆盖] 第一批 policy 单测。
- [x] 3.5 [P0][depends:3.4][I: legacy checkpoint verdict + policy chain][O: shadow evaluation helper][V: 可比较 legacy verdict 与 policy verdict；不替换 `buildCheckpointViewModel`] 增加 shadow evaluation。

## 4. UI Integration

- [ ] 4.1 [P0][UI-DEFER][depends:2.4][I: audit trail][O: `CheckpointPanel.tsx` 增加 policy log 折叠区][V: 默认折叠；现有 verdict UX 0 变化] 接入 UI 折叠区；UI 引用/依赖重构未落稳前只允许做只读 inventory。
- [ ] 4.2 [P0][UI-DEFER][depends:4.1][I: dock + popover 双宿主][O: 双宿主渲染等价][V: dock 与 popover 行为一致] 双宿主测试；跟随 UI surface 接入执行。
- [ ] 4.3 [P0][UI-DEFER][depends:4.1][I: 新增 user-facing 文案][O: `statusPanel.policy.*` i18n key（zh + en）][V: zh 与 en 同步落地] i18n 补齐；UI surface 落稳前延后。

## 5. Spec & CI

- [x] 5.1 [P0][depends:1-3][I: 已实现 policy chain core][O: `specs/checkpoint-policy-chain/spec.md`][V: SHALL 条款 ≤ 30；UI-DEFER 和 RUNTIME-DEFER 明确留存] 起草 core spec。
- [x] 5.2 [P0][depends:5.1][I: chain 行为 / audit / policy 集合][O: `scripts/check-checkpoint-policy-chain.mjs`][V: 包含 chain composition / audit bounding / first-batch policy 三类断言] 新增 parity check 脚本。
- [x] 5.3 [P0][depends:5.2][I: package.json][O: `npm run check:checkpoint-policy-chain`][V: 本地与 CI 入口一致] 接入 npm script。
- [x] 5.4 [P0][depends:5.3][I: CI workflow][O: 三平台接入][V: ubuntu/macos/windows 等价执行] CI 三端接入。

## 6. Governance Gates

- [x] 6.1 [P0][depends:1-3,5][I: core 触及代码][O: 前端基线][V: `npm run typecheck` + targeted checkpoint/policy Vitest] 前端 core 基线。
- [x] 6.2 [P0][depends:5][I: parity check][O: policy chain 证据][V: `npm run check:checkpoint-policy-chain`] policy chain 检查。
- [x] 6.3 [P0][depends:1.4][I: 现有 `checkpoint.test.ts`][O: 0 regression 证据][V: 现有断言全部通过] 现有测试 0 regression。
- [x] 6.4 [P1][depends:1-3,5][I: 测试输出][O: heavy-noise parser 证据][V: `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs`] heavy-noise parser sentry。
- [x] 6.5 [P1][depends:1-3,5][I: 源文件大小][O: large-file 证据][V: `npm run check:large-files:gate`] large-file sentry。
- [x] 6.6 [P0][depends:6.1-6.5][I: 全部 artifact][O: strict 验证][V: `openspec validate evolve-checkpoint-to-policy-chain --strict --no-interactive`] OpenSpec strict validate。

## 7. Completion Review

- [x] 7.1 [P0][depends:6.6][I: validation 输出][O: residual risk 列表][V: 跳过的检查附原因] 记录证据与残余风险。
- [x] 7.2 [P1][depends:7.1][I: 触及边界][O: follow-up backlog][V: large-file-signal-bridge / openspec-signal-bridge / cost-aware policy / persistent audit trail 显式列入] 列出后续 change 接力清单。
- [x] 7.3 [P0][depends:7.1][I: 现有 checkpoint UX][O: 行为 0 regression 声明][V: 用户感知零变化的对照说明] 范围未越界证据。

## 8. Deferred Items

- [ ] 8.1 [UI-DEFER][depends:4.1-4.3][I: UI import/dependency refactor][O: StatusPanel policy log + i18n][V: dock/popover + i18n parity] UI surface stable 后补 policy log。
- [ ] 8.2 [RUNTIME-DEFER][depends:1-3][I: policy chain core][O: `buildCheckpointViewModel` runtime reroute][V: checkpoint.test 0 regression + UI host tests] UI surface stable 后再把 checkpoint 主路径切到 policy chain。

## 9. Validation Evidence

- `npm run check:checkpoint-policy-chain`
  - Pass.
- `npm exec vitest run src/features/status-panel/utils/policies/policyRegistry.test.ts src/features/status-panel/utils/checkpoint.test.ts`
  - Pass: policy registry shadow evaluation and existing checkpoint coverage remain green.
- `npm run typecheck`
  - Pass.
- `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs`
  - Pass: 15 tests.
- `npm run check:large-files:gate`
  - Pass: `found=0`.

## 10. Residual Risk And Follow-Up

- StatusPanel policy log and `statusPanel.policy.*` i18n remain `[UI-DEFER]`.
- Runtime reroute of `buildCheckpointViewModel` remains `[RUNTIME-DEFER]` to avoid changing checkpoint SLA behavior during the UI refactor window.
- `large-file-signal-bridge`, `openspec-signal-bridge`, cost-aware policy, and persistent audit trail remain follow-up changes.
