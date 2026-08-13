# Memory Pick Gate · Technical Design

> **Change**: `add-memory-pick-gate`  
> **Status**: **Phase-1 ready for commit**（2026-08-10 · 自动确认 arm/interrupt 与顶栏 UI 校准）  
> **UI 定稿**: `ux.md` · 金样 `docs/prototypes/memory-pick-gate-ui-variants.html`  
> **范围入口**: `proposal.md`  
> **校准说明**: §1 / §3.2 / §4.4 / §5 / §6 / §7 / §10 / §17–§23 以当前实现为唯一事实源。

---

## 0. 文档地图

| 文档 | 读者 | 内容 |
|------|------|------|
| `proposal.md` | 产品 / 评审 | Why、边界、验收、拍板表 |
| `design.md` | 本文件 · 工程 | 架构、状态机、数据、挂载、降级、实现落点 |
| `ux.md` | 前端 / 设计 | 时序、布局 C、文案、视觉、交互矩阵 |
| `specs/**` | 行为合同 | OpenSpec delta requirements |
| `tasks.md` | 执行拆分 | 可勾选实现任务（含收口项） |
| `README.md` | 导航 | 一页索引 |

---

## 1. Context

### 1.1 实现落点（代码事实 · 2026-08-10 Phase-1）

| 层 | 实现 |
|----|------|
| 编排 | `useThreadMessaging`：Native / Shared / Collab 首段共用 `decideMemoryPickGateEntry` + `openMemoryPickGate` |
| Policy | `memoryPickPolicy` + 内存 `memoryPickSessionStore`（**不持久化**；含 `alwaysPreferredCount`） |
| Gate store | `memoryPickGateStore`：retrieving → awaiting-choice；空/超时/失败 auto-skip；confirm 记 preferred count |
| 检索 | `memoryPickRetrieval` → `listSummary`；超时 `PICK_RETRIEVE_TIMEOUT_MS=1000`；候选上限 **`PICK_CANDIDATE_LIMIT=25`** |
| 注入 | `injectMemoryPickContext` → `source="memory-pick"`；与 `@@` id 去重（manual 优先） |
| UI | `MemoryPickGate` / Host 挂 `MessagesCore` `.memory-pick-gate-slot`（750px 中栏） |
| 详情 Dialog | **portal → `document.body`**；仅详情 Markdown（无摘要分区）；无 header 关闭 icon |
| Composer | `off \| pick \| always`；`single` → `pick`；幕布切模式 **emit 同步菜单** |
| 侧栏标题 | `previewThreadName` / `stripInjectedProjectMemoryBlock` 含 `-pack` |
| 常量 | `ALWAYS_TOP_K=3`（默认预勾）、`ALWAYS_AUTO_CONFIRM_MS=8000`、`PICK_MATCH_MIN_DISPLAY_MS=1000` |

### 1.2 问题（背景）

匹配不可见、不可否决 → 用户不开 Memory Reference → 库存浪费。

### 1.3 解法

发送前 **Pick Gate**：本地检索 → 幕布确认（always = 按 preferred count 预勾 + 可改数量；**仅闸门以 always 进入 awaiting 时** 8s 读秒自动确认）→ 再真正 send。  
**禁止** off 且无手动/闸门时静默注入。

---

## 2. Goals / Non-Goals

### Goals

1. Native / Shared **同一闸门语义与时序**。  
2. 模式：`pick` | `always` | `dismissed`（+ Composer 偏好）。  
3. 注入 `source=memory-pick`；always 默认 **Top 3**。  
4. 空结果 / 超时 / 错误 **不阻塞** 发送。  
5. UI 符合 `ux.md`（C 样式、时序铁律）。  
6. 与 `@@` 共存去重；迁移去掉 `single`。

### Non-Goals

- 改入库 ABCD / 存储 schema / 跨 workspace。  
- Collab worker 独立 Pick 扇出。  
- 新向量库 / 训练反馈闭环（P2）。  
- 改 shared recovery 协议本体。

---

## 3. Architecture

### 3.1 端到端数据流

```text
┌─────────────┐   pressSend    ┌──────────────────────┐
│  Composer   │ ─────────────► │ useThreadMessaging   │
│  mode prefs │                │  (send orchestrator) │
└─────────────┘                └──────────┬───────────┘
                                          │
                    ① append pending user bubble (timeline)
                                          │
                    ② shouldSkipPickGate?
                         │ yes                    │ no
                         ▼                        ▼
                   flushSend                 retrieving
                   (maybe inject)                 │
                         │               localRetrieve()
                         │                        │
                         │              empty/timeout? ──► flushSend([])
                         │                        │
                         │                        ▼
                         │              awaiting-choice UI
                         │              (PickGate under bubble)
                         │                        │
                         │         confirm/skip/dismiss
                         │                        │
                         └──────── flushSend(inject) ──►
                                      │
                    native engine / shared V2 commit
                                      │
                    assistant stream → real Assistant bubble
```

### 3.2 模块划分（已实现路径）

| 模块 | 职责 | 路径 |
|------|------|------|
| Send orchestrator | 拦截 send、open gate、inject、flush | `useThreadMessaging.ts` |
| Policy decision | 是否进闸门 | `memoryPick/memoryPickPolicy.ts` |
| Session policy store | firstPick / dismissed / mode（内存） | `memoryPick/memoryPickSessionStore.ts` |
| Gate UI store | turn phase / candidates / resolve Promise | `memoryPick/memoryPickGateStore.ts` |
| Retrieval | listSummary → Candidate[] + score | `memoryPick/memoryPickRetrieval.ts` |
| Inject builder | selected → pack + preview | `memoryPick/injectMemoryPickContext.ts` |
| PickGate UI | C 布局 + always 倒计时 | `components/MemoryPickGate.tsx` |
| Host | 订阅 store 挂载 | `components/MemoryPickGateHost.tsx` |
| Composer | 三态菜单 | `ButtonArea.tsx` + `Composer.tsx` |
| 侧栏标题净化 | strip pack 前缀 | `utils/threadItemsUserMessage.ts` |

### 3.3 依赖方向

```text
UI (PickGate)
  → policy store (read/write session)
  → retrieval adapter (read-only)
  → onConfirm/onSkip/onDismiss callbacks (owned by messaging)

messaging
  → policy store
  → inject builder
  → engine/shared send
```

**禁止**：PickGate 直接 invoke send engine；只通过 orchestrator callback。

---

## 4. 状态机

### 4.1 Turn 级 `pickPhase`

| 状态 | 含义 | UI |
|------|------|-----|
| `idle` | 无闸门 | — |
| `retrieving` | 本地检索中 | 匹配占位 / skeleton（建议有） |
| `awaiting-choice` | 等待用户 | PickGate 完整 UI |
| `flushing` | 正在真正发送 | 禁用重复提交 |
| `cancelled` | 用户取消本轮 | 气泡移除或回填 |

```text
idle ──pressSend──► retrieving ──has candidates──► awaiting-choice
                         │                              │
                         │ empty/timeout/error          ├ confirm ──► flushing ──► idle
                         ▼                              ├ skip ────► flushing ──► idle
                    flushing ──► idle                   ├ dismiss ─► flushing ──► idle
                                                        └ cancel ──► cancelled ──► idle
```

### 4.2 Session 级 policy

| 字段 | 类型 | 含义 |
|------|------|------|
| `composerMode` | `off` \| `pick` \| `always` | 用户偏好（持久化） |
| `firstPickRequired` | boolean | 新 session 是否还要强制一次 |
| `dismissed` | boolean | 本 session 关闭记忆询问 |
| `memoryCountHint` | number \| null | workspace 是否有记忆（可懒查） |

### 4.3 决策表：是否进入闸门 UI

| # | 条件 | 进入 UI？ | 注入策略 |
|---|------|-----------|----------|
| 1 | `dismissed` | 否 | 0 |
| 2 | 无可检索文本 | 否 | 0 + 原样 send |
| 3 | streaming / 同 turn 重入 | 否（忽略） | — |
| 4 | 队列自动 follow-up | 否 | 按队列策略（默认 0 额外 pick） |
| 5 | `composerMode=off` | **否**（opt-in 默认关闭） | 0（`@@` 仍可） |
| 6 | `firstPickRequired` 且有记忆 **且** mode 为 pick/always | **是（pick 手勾）** | 用户选择 |
| 7 | `composerMode=pick` 且未 dismissed | 是（有候选时） | 用户选择 |
| 8 | `composerMode=always` 且未 dismissed | **是（预览 UI）** | 按 preferred count 预勾 + 可改；以 always 进入 awaiting 才读秒；见 §4.4 |
| 9 | 检索空 | 否（已进 retrieving） | 0 直发 |

### 4.4 always 路径（**Phase-1 合同**）

> 禁止静默直发。预勾可改数量；**不锁死**勾选。

1. **always 且非 firstPick**：`show-ui` / `always-mode` → matching → awaiting-choice。  
2. **预勾**：`selectTopKIds(candidates, resolveAlwaysPrefillCount(alwaysPreferredCount))`；默认 `ALWAYS_TOP_K=3`。  
3. **可改**：checkbox 自由增减；详情 Dialog 可「勾选本条并关闭」。  
4. **读秒武装（arm）**：`ALWAYS_AUTO_CONFIRM_MS=8000`；**仅当进入 `awaiting-choice` 瞬间 `mode` 已是 always** 才武装并启动读秒。  
   - 闸门内 **中途** pick→always：只切换策略/预勾 UI，**不**启动读秒。  
   - count 文案：`count.always`（无读秒）/ `count.alwaysCountdown`（`{{n}}` + `{{sec}}`）。  
   - 确认钮底边进度条 + 「取消自动确认」；顶栏 count 行绿色 `is-countdown`。  
5. **打断（interrupt）**：本轮闸门内任意用户操作默认打断读秒，且**本轮不再重启**（勾选、详情、取消自动、切 mode、skip/dismiss/确认等）。  
   - 实现：`MemoryPickGate` 内 `autoConfirmArmedRef` + `autoConfirmInterruptedRef` + `autoConfirmEpoch`；effect **不**依赖整份 `gate`（避免勾选变更误重启）。  
6. **记住数量**：confirm 时 `setMemoryPickAlwaysPreferredCount(selectedIds.length)`；下轮按相同条数按相关分预勾。  
7. **firstPick**：偏好 always 时第一次仍走 **pick 手勾**；完成后 `firstPickRequired=false`。  
8. **空/超时/失败**：auto-skip 0 注入。

### 4.5 时序铁律

1. 用户气泡 **先** 上屏（`pending`）。  
2. 其 **下** 才是挑选流；**之上禁止** 本轮语义的 Assistant 文案。  
3. 角色条：记忆参考 · 发送前 · 匹配完成 · 请选择后发送（非 Assistant）。  
4. 仅确认/跳过/dismiss 后真正 send → 模型流。

---

## 5. 模式语义（产品定稿 · Phase-1）

| 模式 id | 用户文案（zh 示意） | 行为 | 列表 |
|---------|---------------------|------|------|
| `pick` | 本轮挑选记忆注入 | 手勾；默认全不选；仅本次 | 可勾；行高固定 36px |
| `always` | 整轮开启自动 top(n) 记忆注入 | session 每轮预勾 n 条（可改 n）；**以 always 打开闸门时**才读秒 | 可勾；TOP 徽章仅为排序提示 |
| `dismissed` | 本 session 不再提示 · 整轮关闭记忆注入 | 本轮 0 + 本 session 不再弹 | 无 |

**删除**

- Composer / 闸门 **单次开启引用**。  
- 右侧策略菜单 **关闭**（并入底栏 dismiss）。  
- always **锁定勾选**（已废止）。

**Composer 迁移映射**

| 旧 | 新 |
|----|-----|
| `off` | `off`（无闸门；firstPick 仍可能一次） |
| `single` | `pick` |
| `always` | `always`（每轮 UI + preferred count，非旧 Scout 静默） |

**幕布 ↔ Composer 同步**

- 闸门内 `setMode(pick|always)` → `setMemoryPickComposerMode` + `emitMemoryPickComposerMode`。  
- Composer 监听 `ccgui:memory-pick-composer-mode`，按 workspace/thread 过滤后更新菜单勾选。

> 旧 always = 每轮 Scout 静默注入。新 always = 每轮 UI + 预勾 n（可改）+ 以 always 进入 awaiting 才读秒，first 次可强制手勾。

**底栏（icon + 文案）**

| 操作 | 效果 |
|------|------|
| 确认并发送 | pick/always：当前勾选集（可 0） |
| 不选，直接发送 | 本轮 0 注入；模式可保持 |
| dismiss | `dismissed=true` + 本轮 0 注入 |

---

## 6. 检索与注入合同

### 6.1 检索

| 项 | 值 |
|----|-----|
| 范围 | 当前 `workspace_id` |
| 实现 | `memoryPickRetrieval` → `listSummary` + 既有 scout/lexical |
| 候选展示条数 | `PICK_CANDIDATE_LIMIT` = **25** |
| always 默认预勾 | `ALWAYS_TOP_K` = **3**（可被 `alwaysPreferredCount` 覆盖） |
| 排序 | 相关分降序；同分 `updatedAt` 新者优先 |
| 超时 | `PICK_RETRIEVE_TIMEOUT_MS` = **1000**；超时 → 0 注入直发 |

### 6.2 注入载荷（与 `formatProjectMemoryRetrievalPack` 对齐）

```text
<project-memory-pack
  source="memory-pick"
  count="{k}"
  cleaned="true|false"
  cleanerStatus="..."
  truncated="true|false"
>
  Cleaned Context: ...
  Conflicts: ...
  Irrelevant Records: ...
  Source Records: ...
  Instruction: ...
</project-memory-pack>
{user original text}
```

- **未**在 pack 属性上写 `mode` / `topk`；always vs pick 靠 preview 文案与 session policy 区分（审计 source 统一 `memory-pick`）。  
- 预算 / cleaner：`cleanProjectMemoryRecordsForRequest` + retrieval pack。  
- 与 `manual-selection`：同 `memory id` **去重**，manual 先注入。  
- 用户可见气泡：**仅** 用户原文；pack 进 summary 卡（`buildMemoryPickPreviewText`）。

### 6.3 候选 DTO（前端）

```ts
type MemoryPickCandidate = {
  id: string;
  title: string;
  summary: string;
  score: number;          // 0..1 展示用
  kind?: string;
  importance?: string;
  tags?: string[];
  engine?: string;
  threadId?: string;
  updatedAt?: string;
  // detail lazy-load on dialog open
};
```

### 6.4 Session / Turn 状态 DTO

```ts
type MemoryPickComposerMode = 'off' | 'pick' | 'always';

type MemoryPickSessionPolicy = {
  composerMode: MemoryPickComposerMode;
  firstPickRequired: boolean;
  dismissed: boolean;
  /** 一直开启：上次确认勾选条数；下轮按相关分预勾相同数量 */
  alwaysPreferredCount: number;
};

type MemoryPickTurnState = {
  turnId: string;
  phase: 'idle' | 'retrieving' | 'awaiting-choice' | 'flushing' | 'cancelled';
  queryText: string;
  candidates: MemoryPickCandidate[];
  selectedIds: string[];      // pick 模式
  modeAtOpen: MemoryPickComposerMode; // 打开闸门时的模式快照
  error?: 'timeout' | 'retrieve_failed' | null;
};
```

---

## 7. UI 挂载（Phase-1 实现）

### 7.1 结构

```text
turn-group
  user-bubble[pending]
  .memory-pick-gate-slot (max-width 750, 与 .messages-full 同中)
    MemoryPickGateHost
      MemoryPickGate
        role-bar
        split
          left: list (fixed 36px rows) + count(读秒)
          right: mode menu + strategy panel
        foot: icon+text actions (非胶囊按钮)
      detail Dialog → createPortal(document.body)
```

### 7.2 视觉（Phase-1）

- 无厚外框；hairline 分隔。  
- 列表行高 **固定 36px**；`align-content: start`（条目少不撑开）。  
- 底栏：**icon + 文案** 文字操作（Send / SkipForward / BellOff），去圆角填充按钮。  
- always 读秒：顶栏 count 行绿色高亮实时 `Ns`（`count.alwaysCountdown`）；仅 arm 后展示。  
- 顶栏强制单行 + ellipsis；策略菜单与操作区虚线框。  
- 详情 Dialog：portal 全屏遮罩 `z-index: 10050`；**仅详情 Markdown**（无摘要 section）；footer 关闭 + 勾选本条。  
- 行背景：仅 **已勾选** 高亮（pick accent / always green）；TOP 徽章不刷底。

### 7.3 组件路径

| 组件 | 路径 |
|------|------|
| Gate UI | `components/MemoryPickGate.tsx` |
| Host | `components/MemoryPickGateHost.tsx` |
| Hook | `memoryPick/useMemoryPickGate.ts` |
| Styles | `styles/memory-pick-gate.css` |
| Markdown | `markdown/components/Markdown`（与 ProjectMemoryPanel 同栈） |

### 7.4 挂载点

- `MessagesCore` → `.memory-pick-gate-slot`（pending 用户气泡后）。  
- 确认后卸 gate；k>0 summary 卡（既有 memory-context-summary）。

---

## 8. Composer 控制面

### 8.1 菜单项（新）

| mode | 文案（zh 示例） |
|------|-----------------|
| off | 关闭 |
| pick | 本轮挑选（原「单次」位替换） |
| always | 一直开启（session · 默认 Top3） |

### 8.2 与闸门关系

- `off`：不自动进闸门（除 firstPick）。  
- `pick`：每轮有候选则进闸门。  
- `always`：见 §4.4。  
- dismiss **不**自动把 composerMode 写成 off；仅 session `dismissed`。Composer 可显示「本 session 已静音」并提供恢复。

### 8.3 `@@`

- 不变：手动候选 + one-shot。  
- 与 gate 同时存在时 id 去重。

---

## 9. Native / Shared / Multi-agent

| 路径 | 要求 |
|------|------|
| Native 全 engine | 闸门在 FE send 入口统一；inject 后再 command |
| Shared V2 | inject 在 V2 committed **之前**完成；不得因 early-return 丢 inject |
| Shared V1 | 同 FE 入口 |
| Collab / squad | **MVP 不**对 worker 单独闸门；主幕 pick 结果不默认 fan-out 全量 pack |

---

## 10. 持久化与生命周期

| 状态 | 范围 | **当前存储** | 重置 |
|------|------|--------------|------|
| composerMode | Composer + session 镜像 | Composer 本地 + **内存** session | 菜单 / 闸门 setMode emit |
| firstPickRequired | thread | **仅内存** | 新 thread true；完成后 false |
| dismissed | thread | **仅内存** | 新 thread false；刷新丢失 |
| alwaysPreferredCount | thread | **仅内存** | 默认 3；confirm always 时更新 |
| turn gate | turn | 内存 only | settle / 同 thread 重入 cancel 旧 Promise |

**Phase-1 限制**：session policy **不跨刷新**。  
**刷新 / 崩溃**：未 confirm 不调模型；禁止半发送幽灵态。

---

## 11. 错误与降级

| 场景 | 行为 | 用户可见 |
|------|------|----------|
| 检索超时 | 0 注入 flushSend | 可选 toast：记忆检索超时，已直接发送 |
| 检索失败 | 同上 | 可选 toast |
| 空候选 | 同上（无 UI） | 可选无 toast，避免吵 |
| inject 构建失败 | 0 注入仍 send | toast 失败原因 |
| flushSend 失败 | pending 可重试；保留用户原文 | 现有错误面 |
| Dialog 拉 detail 失败 | Dialog 内错误态；不关闸门 | 重试按钮 |

---

## 12. 可观测性

建议事件（实现期埋点名可映射现有 analytics）：

| event | props |
|-------|--------|
| `memory_pick_gate_shown` | mode, candidateCount, firstPick |
| `memory_pick_confirm` | mode, selectedCount, alwaysTopK |
| `memory_pick_skip` | mode |
| `memory_pick_dismiss` | — |
| `memory_pick_retrieve` | ms, count, timeout\|ok\|empty |
| `memory_pick_cancel` | phase |

日志前缀：`[memory-pick-gate]`，禁用户原文全文入日志（可 hash / 长度）。

---

## 13. i18n

- 新增 key 命名空间建议：`memoryPick.*` 或 `composer.memoryPick*` + `messages.memoryPick*`。  
- 策略长文案（ux.md §5）必须进 zh/en（至少）。  
- 删除或改写 `memoryReferenceEnableSingle` 等 single 文案。

---

## 14. 测试计划

### 14.1 单元

- policy 决策表（§4.3）矩阵。  
- TopK 排序与去重。  
- inject pack 字段。  
- 超时 / 空结果降级。

### 14.2 组件

- Pick 列表勾选、always 锁定、详情 Dialog。  
- 模式切换更新 hint / 说明面板。  
- 底栏三按钮回调。

### 14.3 集成（messaging）

- 时序：pending bubble 先于 gate。  
- confirm 才调用 send mock。  
- Shared 路径 inject 在 commit 前。  
- firstPick / dismiss 跨 turn。

### 14.4 回归

- `@@` 仍可用。  
- off 默认不注入。  
- 既有 memory-context-summary 渲染。

---

## 15. 风险与缓解

| Risk | Mitigation |
|------|------------|
| 摩擦 | firstPick + dismiss + always 预览倒计时可取消 |
| 旧 single 用户 | 映射 pick + 文案迁移 |
| 检索拖发送 | 1s 超时 + 空结果 auto-skip |
| 双注入 | id 去重 manual 优先 |
| 刷新丢 dismissed / firstPick | 内存 store；文档标明；P1 持久化 |
| 侧栏标题被 pack 污染 | `stripInjectedProjectMemoryBlock` 含 `-pack` |
| always 与旧 Scout | 新路径统一 memory-pick；legacy scout 仅兼容旧 flag |
| 主线程 jank | 检索异步；候选 ≤10 |

---

## 16. 迁移与回滚

### 迁移

1. Specs delta + tasks。  
2. FE 状态机 + UI + Composer。  
3. 默认 feature：`memoryPickGate` **on**。  
4. 持久化字段兼容：读到 `single` → 当 `pick`。

### 回滚

- flag off → 旧 off/single/always Scout 路径（或 off/pick 静默关闭闸门）。  
- 无 DB migration；prefs 向后兼容读。

---

## 17. 分阶段交付

| 阶段 | 内容 | 状态 |
|------|------|------|
| **Phase-1（闸门）** | 时序 + C UI + dismiss + firstPick + inject + Composer 三态 + always 读秒 + Dialog/Markdown + 测试 | ✅ 已合 |
| **Phase-2（匹配 + 可感 + 转接）** | hybrid 核 + emptyReason 时间线 + telemetry + Pack 语义转接；不改 ABCD | ✅ `af112cdde` · change `enhance-memory-pick-retrieval-and-observability` |
| **Phase-3（习惯 + 真语义）** | session 持久化；dismiss→pick；设置页按需下载 ONNX 到用户主目录 `.ccgui`；embed-index 旁路；语义/词面开关；hybrid 门槛与预热 | ✅ 已实现 · `enhance-memory-pick-phase3-habit-and-semantic` |
| **P4 更后** | cancel 回填 Composer；设置页 n/超时；负反馈；feature flag；collab worker 独立 Pick；L2/L3 | 未做 · 勿照搬 MemOS 全栈 |

---

## 18. 验收矩阵（Phase-1）

| ID | 场景 | 期望 | 状态 |
|----|------|------|------|
| A1 | 有候选 + pick | 气泡 → gate → 确认前无 model | ✅ |
| A2 | pick 勾 0 | 0 注入 | ✅ |
| A3 | pick 勾 k | pack source=memory-pick | ✅ |
| A4 | skip | 0 注入；first-pick 后固化 pick | ✅ |
| A5 | dismiss | 0 + session 静音 | ✅ 内存 |
| A6 | firstPick | 首次强制 pick UI | ✅ |
| A7 | always | 预勾 n（默 3，可改）+ 以 always 进入 awaiting 才读秒 + 交互打断本轮不重启 + 记住 n | ✅ |
| A7b | always 中途切 | pick→always 不启动读秒 | ✅ |
| A8 | 空检索 | auto-skip | ✅ |
| A9 | 超时 | 0 注入 | ✅ |
| A10 | Shared / Collab | 同入口 | ✅ |
| A11 | @@ + pick | id 去重 | ✅ |
| A12 | 时序 | 无伪 Assistant 压顶 | ✅ |
| A13 | UI | 无厚框；36px 行；icon 底栏；详情 portal+MD | ✅ |
| A14 | 侧栏标题 | 用户输入非 pack | ✅ |
| A15 | 幕布↔Composer 模式 | 切换同步 | ✅ |
| A16 | 列表条目少 | 行高不撑开 | ✅ |

---

## 19. Open Questions（Phase-1 默认）

| # | 问题 | **默认** |
|---|------|----------|
| 1 | always 每轮 UI？ | 每轮 + 读秒 + 可改 n |
| 2 | always 锁勾选？ | **否**；TOP 仅提示 |
| 3 | 取消回填 Composer？ | Phase-1 不做；P1 |
| 4 | 设置页调 n/超时？ | 常量；P2 |
| 5 | firstPick × always？ | 仍先 pick 一次 |
| 6 | session 持久化？ | 内存 only；P1 |

---

## 20. 代码触点清单

| 区域 | 路径 |
|------|------|
| Send | `src/features/threads/hooks/useThreadMessaging.ts` |
| Pick 模块 | `src/features/project-memory/memoryPick/*` |
| Gate UI | `src/features/project-memory/components/MemoryPickGate*.tsx` |
| Pack | `src/features/project-memory/utils/projectMemoryRetrievalPack.ts` |
| Composer | `ButtonArea.tsx` · `Composer.tsx` |
| 挂载 | `MessagesCore.tsx` |
| Summary/详情 | `MessageRow.tsx` |
| 标题 | `threadItemsUserMessage.ts` · `sessionDisplayProjection.ts` |
| 样式 | `memory-pick-gate.css` · `messages.part1.css` |
| i18n | `locales/*/composer.ts` · `memory.ts` · `messages.ts` |
| 测试 | `memoryPick/*.test.ts` · `MemoryPickGate.test.tsx` · `useThreadMessaging.memory-pick.test.tsx` · `threadItemsUserMessage.test.ts` |

---

## 21. 文档关系

```text
proposal.md  ──范围──┐
design.md    ──工程──┼──► 实现 + specs delta + tasks
ux.md        ──UI────┘
prototype.html ──金样
```

---

## 22. 实现校准记录

### 22.1 相对初稿（仍有效）

| 项 | 初稿 | **Phase-1 实现** |
|----|------|------------------|
| always | 静默 Top3 | 每轮 UI + 预勾 n + 读秒 |
| always 锁勾选 | 锁定 Top3 | **已解锁**；记 preferred count |
| pack 属性 | mode/topk | 仅 source/count/cleaned/… |
| session | thread meta | **仅内存** |
| 候选上限 | 10 | **25** |

### 22.2 Phase-1 验收 polish（本轮二次校准）

| 项 | 实现 |
|----|------|
| 详情 Dialog | portal body；仅详情 Markdown；无摘要；无 header × |
| 底栏 | icon+文案，去胶囊按钮 |
| 列表 | 行高 36px；条目少不撑开 |
| 读秒 | 列表 count 行实时 Ns（`is-countdown`） |
| Composer 文案 | 与幕布策略轨对齐（本轮挑选 / 一直开启类） |
| 模式同步 | 幕布 setMode → emit → Composer 菜单 |
| 侧栏标题 | strip `project-memory-pack` |

### 22.3 不阻塞 Phase-1 的 P1 缺口

1. session policy 刷新丢失（dismissed / firstPick / preferredCount）。  
2. Composer 无 dismissed 恢复入口。  
3. cancel 不回填 Composer。  
4. 埋点 §12 未落地。  
5. 无 feature flag。  
6. 历史脏 title 不自动重算。  
7. pack 无 mode/topk 属性。

### 22.4 Phase-1 commit 建议包含

- `src/features/project-memory/memoryPick/**` + Gate 组件 + CSS  
- `useThreadMessaging` + memory-pick 测试  
- Composer / MessageRow / MessagesCore / pack / i18n  
- 标题 strip + sessionDisplayProjection（若相关）  
- `openspec/changes/add-memory-pick-gate/**` + prototype + research 指针  

建议 message：

```text
feat(memory-pick): 发送前记忆挑选闸门 Phase-1

- Native/Shared/Collab 统一 pick/always 闸门与 memory-pick 注入
- always 可改预勾条数并记忆；8s 读秒可取消
- 详情 Dialog portal + Markdown；底栏 icon 文案；固定行高
- 侧栏标题剥离 project-memory-pack；幕布与 Composer 模式同步
- 回写 openspec add-memory-pick-gate 设计与验收合同
```

---

## 23. Phase-1 收口检查单

- [x] 功能代码与单测/集成测在工作区  
- [x] design / proposal / tasks / specs 与代码对齐（本次）  
- [ ] 提交前：`pnpm vitest run` 记忆相关套件  
- [ ] 提交前：`openspec validate add-memory-pick-gate --strict --no-interactive`（若环境可用）  
- [ ] `git commit`
- [ ] 人工冒烟：pick / always 读秒 / dismiss / 详情 MD / 侧栏标题
