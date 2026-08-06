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
