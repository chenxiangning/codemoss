## Context

当前 messages render pipeline 保护了两条关键性能轨道：stable parent timeline snapshot 与 row-level live override。核心组件同时承载 presentation derivation、scroll orchestration、timeline projection、virtualization/hydration、row dispatch、rich row rendering 和 diagnostics，导致文件规模与 props surface 持续扩大。重构必须以现有 `dev-guidelines/frontend/messages-streaming-render-contract.md` 和 render-jank baseline 为约束，而不是重新发明 streaming architecture。

## Goals / Non-Goals

### Goals

- 建立 `orchestration / timeline / rows` 高内聚领域边界。
- 通过 typed view models 收敛接口，同时保持更新频率显式。
- 保留 public entry path，控制 import churn。
- 将 pure helper、React controller 与 JSX renderer 分离。
- 通过阶段化验证证明 behavior equivalence。

### Non-Goals

- 不修改产品行为、DOM/CSS/i18n、Markdown/toolBlocks、runtime/backend。
- 不通过 React Context 隐藏依赖。
- 不在本次工作中追求所有文件达到任意绝对行数阈值。

## Target Directory

```text
src/features/messages/
  components/
    Messages.tsx                 # public orchestration entry
    MessagesTimeline.tsx         # timeline controller + row dispatch
    MessagesRows.tsx             # MessageRow / ReasoningRow / WorkingIndicator
    Markdown.tsx
    toolBlocks/
  orchestration/
    components/
    hooks/
    models/
    presentation/
    interactions/
    scrolling/
  timeline/
    components/
    projection/
    virtualization/
  rows/
    components/
    presentation/
```

首期允许根据真实职责合并过薄文件，但禁止重新形成单层几十个同级文件或 `common/sharedUtils` 万能目录。

## Typed View Models

`MessagesTimeline` 收敛为以下职责模型：

```ts
export type MessagesTimelineProps = {
  snapshot: TimelineSnapshotModel;
  live: TimelineLiveModel;
  runtime: TimelineRuntimeModel;
  navigation: TimelineNavigationModel;
  interactions: TimelineInteractionModel;
  presentation: TimelinePresentationModel;
  slots: TimelineSlotsModel;
};
```

- `snapshot`: grouped entries、boundary sets、reasoning metadata、file-change summaries、collapsed history count。
- `live`: live assistant/reasoning override、stream phase、working state。
- `runtime`: workspace/thread/engine、history/reconnect/user-input runtime state。
- `navigation`: refs、pending jump、auto-scroll/bottom-convergence callbacks。
- `interactions`: copy/toggle/open/retry/recovery/fork/rewind/note actions。
- `presentation`: profile、mode、expanded ids、lightweight/mitigation options。
- `slots`: approval/user-input React nodes。

模型必须按更新频率分别保持 shallow-stable identity；禁止在 JSX 内构造未稳定的新 object。high-frequency `live` 变化不得重新创建 `snapshot`、`navigation` 或 `interactions`。

## Dependency Direction

```text
components/Messages
  -> orchestration hooks/models
components/MessagesTimeline
  -> timeline projection/virtualization/components
  -> components/MessagesRows
components/MessagesRows
  -> rows presentation/components
  -> Markdown / toolBlocks
```

- `rows` 不得 import `timeline` 或 `orchestration`。
- `timeline` pure modules 不得 import `orchestration`；public controller 可 type-import typed view models。
- pure selector 不得 import React component。
- public entry 与领域子模块不得形成双向 barrel dependency。

## Migration Strategy

1. Baseline：运行 focused tests/typecheck/large-file report，记录现有状态。
2. Move-only helpers：按领域迁移 pure helpers；完成 import 切换后删除无引用的旧路径壳。
3. Typed models：新增 model + adapter，先收敛接口，不同时拆 JSX。
4. Timeline：下沉 lightweight prompt 与 virtual/static projection viewport，projection/virtualization/hydration pure helpers 归位领域目录。
5. Rows：抽离 GeneratedImage/Review/Diff/Explore presentation rows；MessageRow/ReasoningRow/WorkingIndicator 继续共置，以保护 live text channel 与 memo comparator。
6. Messages：抽 typed model stabilizer、anchor navigation controller 与 linked-run banner，收敛 public entry。
7. Cleanup：删除 dead compatibility implementation、检查循环依赖并跑完整 gates。

## Risks and Mitigations

- **Risk: object bundling causes rerenders** — 每个 model 独立 memo，live/stable 分轨测试锁定。
- **Risk: move changes module singleton/cache identity** — move-only phase保留单一实现，旧路径只 re-export。
- **Risk: virtualization layout regression** — 保留 threshold、row key、measurement/ref owner，运行 virtualized-jump/hydration tests。
- **Risk: scroll behavior regression** — 保留 programmatic echo、history/manual jump intent、bottom convergence owner，运行 live-behavior/scroll tests。
- **Risk: circular dependency** — 依赖方向检查 + `rg` import audit；不使用双向 barrel。
- **Risk: whole-file relocation trips the 800-line new-file ratchet** — 核心 public entry 保留原路径，只创建小于 ratchet 的真实职责模块；`Messages.tsx` 降至 policy fail threshold 以下。

## Validation

```bash
npx vitest run src/features/messages
npm run lint
npm run typecheck
npm run test
npm run check:large-files
npm run check:heavy-test-noise
openspec validate --change refactor-messages-presentation-architecture --strict
git diff --check
```
