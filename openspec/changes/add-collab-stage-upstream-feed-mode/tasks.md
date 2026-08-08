## 1. 模型与绑定

- [x] 1.1 [P0] FE：`CollaborationTemplateStage.upstreamFeedMode`、normalize/default、`templateToStageBindings` 贯通；templateStore 读写兼容缺省。
- [x] 1.2 [P0] BE：`AgentStageBindingInput` / stage projection 字段；apply bindings 写入；旧数据缺省 summary。

## 2. 运行时

- [x] 2.1 [P0] `prior_feed_notes(run, stage_index)` 替换/包装 `last_succeeded_notes`；full 用 full_outcome+cap，summary 用 short。
- [x] 2.2 [P0] `build_stage_prompt` / implement 路径：非空 notes 必入 prompt；Rust 单测。

## 3. UI / Inspector

- [x] 3.1 [P0] `TemplateManagerModal`：index>0 显示摘要|全文滑动；i18n 全 locale。
- [x] 3.2 [P0] `buildStageInjectContext` 按当前段 mode 选 short/full；单测。

## 4. Gates

- [x] 4.1 [P0] focused vitest + agent_orchestration tests；locale parity。
- [ ] 4.2 [P1] 手测：旧模板 summary；新模板定稿 full 后 prompt/Inspector 可见更长上游。
