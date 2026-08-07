## 1. OpenSpec / 基石文档

- [x] 1.1 完成本 change proposal / design / specs / tasks
- [x] 1.2 更新 `docs/research/mossx-multi-cli-provider-session-foundation-design.md` 校准表（collab digest → Runtime Context；sidebar spawn 闸）
- [x] 1.3 `openspec validate fix-shared-collab-context-and-sidebar-spawn --strict`

## 2. Backend：stage outcome body

- [x] 2.1 `record_stage_and_maybe_advance` 各成功/失败路径写入 `outcome.body`（cap）+ 保留 `summary`
- [x] 2.2 plan 门闩路径 body = plan.markdown 或 raw
- [x] 2.3 projection 读 `body` 优先填充 `full_outcome`

## 3. Backend：context compiler

- [x] 3.1 `transform_event` 支持 `squad.nodeOutcomeRecorded` → portable assistant 文本
- [x] 3.2 source 过滤：nodeOutcome 豁免 squad_attempt 剔除与 destination-owned 剔除
- [x] 3.3 collab control user turn 可 omission（briefing/summary marker）
- [x] 3.4 Rust 单测：含 nodeOutcome 的 compile 结果含 stage 正文；无 collab 路径不变

## 4. Frontend：sidebar spawn 闸

- [x] 4.1 strip helper 剔除 context-protocol 标题的 native 行
- [x] 4.2 Vitest 覆盖 MOSSX_CONTEXT / 正常标题保留

## 5. 验证与 review

- [x] 5.1 focused cargo test / vitest
- [x] 5.2 自检 diff 与验收对照
- [x] 5.3 **不 git commit**；交付用户检查

## 6. Follow-up（2026-08-07）：截断 `MOSSX_*` 侧栏标题闸

- [x] 6.1 盘点 runtime 注入 token 全量（PACKAGE / ACCEPTED / NATIVE_V1 / SHARED_V1）与遗漏（clip 后严格 classify 失败）
- [x] 6.2 `isMossxProgramControlTitle` 行首闸 + `isSharedControlPlaneSpawnTitle` 合并
- [x] 6.3 `mergeNativeCliSessionSummaries` / Claude / OpenCode raw 预过滤
- [x] 6.4 Codex catalog：非 continuation drop；continuation 用 control 闸改写「继续：…」
- [x] 6.5 `sessionDisplayProjection`：截断 MOSSX_ weak + mapped 丢弃
- [x] 6.6 Vitest：截断 title / 全 token / 用户正文 / Grok merge drop
- [x] 6.7 补充本 change proposal / design / shared-session-thread delta / foundation 校准
- [x] 6.8 `openspec validate fix-shared-collab-context-and-sidebar-spawn --strict`
- [ ] 6.9 用户实机：Shared context 注入后侧栏无 `MOSSX_*` 行首 native 行
- [ ] 6.10 **不 git commit** 直至用户 review 通过
