## 1. Loader / open path

- [x] 1.1 调整 Shared 历史打开：`loadSharedSession` 完成后即可 Phase-A hydrate，并 **clear `historyLoading`**（不得等 projection）
- [x] 1.2 `loadSharedProjection` 改为后台任务；成功后 `mergeHistoryProjectionItems` + hydrate；带 threadId/generation stale 守卫
- [x] 1.3 为 projection 等待增加 **可注入软超时**（默认约 12s）；超时保留 V0，可观测 warn/diagnostics
- [x] 1.4 无 V0 且 projection 失败：保持现网 fail-closed（history failed / 可重试）
- [x] 1.5 进度：Phase-A 后禁止整页 curtain 钉在 `restoringSharedHistoryProjection`；必要时弱提示或省略

## 2. 发送 / recovery 解耦

- [x] 2.1 确认 composer/send 门禁不读「projection 未完成」；仅 recovery/target 等既有条件
- [x] 2.2 回归：recovery-required 仍锁发送；clear 后 + Phase-A 即可发
- [x] 2.3 文档注释：recovery「已解除锁定」≠ history projection 完成
- [x] 2.4 迟到 projection hydrate：与 **live canvas items** merge（非整表覆盖）

## 3. 测试

- [x] 3.1 `sharedHistoryLoader`（或调用方）单测：V0 先 ready、projection 慢/失败保留 V0
- [x] 3.2 projection 成功迟到：merge 后 items 符合既有 merge 权威
- [x] 3.3 `useThreadActions` shared-history 测试：loading 在 V0 后清除
- [ ] 3.4 Messages history-loading：Shared 不再因 projection phase 整页阻塞（如有契约测试则更新）

## 4. 可选 P1（同 PR 或 follow-up）

- [ ] 4.1 静默 span：`session_ms` / `projection_ms` / timeout 写入既有 diagnostics（无用户步骤）
- [x] 4.2 Rust `load_shared_projection` enrich 不进 first-paint（已因后台调用自然后置则勾选说明）

## 5. 验证

- [ ] 5.1 本地：打开长 Shared，确认 curtain 在 session 阶段后很快消失，对话可发
- [x] 5.2 `openspec validate --change fix-shared-history-projection-nonblocking --strict --no-interactive`（或仓库等价）
- [x] 5.3 相关 vitest 通过
