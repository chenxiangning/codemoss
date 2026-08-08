## Context

跨段注入现状（`commands.rs`）：

```rust
fn last_succeeded_notes(run) -> String {
  // 所有 Succeeded 的 short_outcome，\n---\n 拼接
}
// start_stage_attempt → build_stage_prompt(..., &last_succeeded_notes(run))
```

- `short_outcome` ≈ 160 字（`STAGE_SHORT_OUTCOME_CHARS`）
- `full_outcome` ≈ 12_000 字安全阀（`STAGE_OUTCOME_BODY_CHARS` / FINAL）
- 首段：`request_text` 全文（含 skill 等 fan-in）
- Inspector 注入 Header 目前只读 `shortOutcome` 展示上游

产品要求：模板行上为第 2 段起配置本段吃上游摘要还是全文。

## Goals / Non-Goals

**Goals:** 字段贯通、默认 summary、UI 滑动、运行时与 Inspector 一致、可测。

**Non-Goals:** 选择「仅直接前驱」、动态按 token 预算、运行中改 mode。

## Decisions

### 1. 字段命名与取值

```ts
type UpstreamFeedMode = "summary" | "full";
// CollaborationTemplateStage.upstreamFeedMode?: UpstreamFeedMode
// 缺省 / undefined === "summary"
```

Rust：`upstream_feed_mode: Option<String>`（`"summary" | "full"`），serde camelCase。

### 2. 默认与首段

| 段 | 控件 | 生效 |
|----|------|------|
| index 0 | 不展示 | 始终用户全文；忽略字段 |
| index ≥ 1 | 展示 摘要\|全文 | 启动本段时读取本段 binding/projection |

内置/旧自定义：无字段 → summary。

### 3. 运行时 notes 组装

```rust
fn prior_feed_notes(run: &AgentProjectionV1, stage_index: usize) -> String {
    let mode = run.stages.get(stage_index)
        .and_then(|s| s.upstream_feed_mode.as_deref())
        .unwrap_or("summary");
    let use_full = mode == "full";
    run.stages.iter().take(stage_index)
        .filter(|s| s.status == Succeeded)
        .filter_map(|s| {
            if use_full {
                s.full_outcome.as_deref()
                    .filter(|t| !t.trim().is_empty())
                    .or(s.short_outcome.as_deref())
            } else {
                s.short_outcome.as_deref()
            }
        })
        .map(|t| if use_full { cap_text(t, STAGE_OUTCOME_BODY_CHARS) } else { t.to_string() })
        // short 已短，可直接
        .collect::<Vec<_>>().join("\n---\n")
}
```

审查/中间通用分支：`upstream_notes = prior_feed_notes(run, stage_idx)`。  
`implement_prompt` 当前只塞 plan：若存在 plan 且中间段，**仍保留 plan**；`upstream_notes` 在 review/generic 路径已用。为避免「full 配了却走 implement_prompt 丢 notes」：

- **若** `stage_index > 0` 且 `prior_feed_notes` 非空：在 `implement_prompt` 结果后 **追加**「上游环节产出」块，或统一走可扩展 base。
- 最小改动：**implement 成功路径后 `format!("{base}\n\n上游环节产出：\n{notes}")` when notes non-empty**。

### 4. 模板 UI

`TemplateManagerModal` 环节行（约「需批准」旁 / 红框空白区）：

```
[ 摘要 | 全文 ]  // segment control 或 switch 语义：summary 左 / full 右
```

- 仅 `index > 0` 渲染
- 文案 i18n：`multiAgent.template.upstreamFeedSummary` / `upstreamFeedFull` / `upstreamFeedAria`
- 默认 summary

### 5. Inspector 对齐

`buildStageInjectContext`：读当前 stage 的 `upstreamFeedMode`（projection 字段；缺省 summary）：

- summary：现逻辑 shortOutcome（+ plan 摘要）
- full：优先 `directPrior.fullOutcome`，否则 short；展示 cap 可放宽到 2000 字 + UI clamp

### 6. 兼容

| 场景 | 行为 |
|------|------|
| 旧模板 JSON 无字段 | summary |
| 旧 run projection 无字段 | summary |
| full 但前序无 full_outcome | 回退 short |

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| full 撑爆 token | cap_text body 上限；默认 summary |
| implement 路径忽略 notes | design §3 强制追加 |
| UI 拥挤 | 仅第 2 段起；文案短 |

## Migration Plan

- 纯加可选字段；回滚删字段即可，旧 run 回放 summary。

## Open Questions

- 无（默认 summary、首段隐藏、full=cap 后的 full_outcome 已确认）。
