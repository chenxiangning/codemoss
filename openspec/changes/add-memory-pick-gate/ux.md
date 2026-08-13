# Memory Pick Gate · UI/UX 定稿

> **Status**: 产品方满意后的实现指导依据（2026-08-10）  
> **金样**: `docs/prototypes/memory-pick-gate-ui-variants.html`（仅 C 样式）  
> **行为合同**: 同目录 `proposal.md` / `design.md`；主 specs 以 delta 落地为准。

本文汇总从「消费用不起来」到 C 样式定稿的全部沟通结论，供实现与评审对齐。

---

## 1. 问题与产品方向

### 1.1 现象

- 项目记忆 **有数据**（大量来自对话 turn 采集）。
- 已有：`@@` 手动选；Composer **记忆参考**（关闭 / 单次开启 / 一直开启）。
- 痛点：匹配不透明、不可否决 → **不敢开、用不起来**。

### 1.2 方向

在发送前增加 **半自动闸门**：

1. 本地按用户本轮输入检索候选  
2. 幕布展示并让用户 **复选**（或 always 默认 Top3）  
3. 确认后再调模型  

**禁止**恢复静默自动注入。

---

## 2. 时序（最高优先级）

### 2.1 正确时序

```text
用户点发送
  → ① 用户气泡上屏，标记「待发送」
  → ② 其下挂「记忆参考」挑选流（本地检索，尚未调用模型）
  → ③ 用户：确认并发送 / 不选直接发送 / 本 session 不再提示·关闭记忆参考
  → ④ 组装 inject（可为 0）后 flushSend
  → ⑤ 模型流到达后，才出现真正的 Assistant 回复
```

### 2.2 错误时序（禁止）

| 错误 | 原因 |
|------|------|
| 待发送用户气泡 **上方** 放本轮语气的 Assistant 文案 | 读成「助手先回了再发」 |
| 先调模型再展示挑选 | 闸门失效 |
| 先上挑选卡、用户气泡确认后才出现 | 与「可感、先上屏」拍板冲突 |

### 2.3 角色标签

挑选流可用弱角色条（**不是** Assistant 正文）：

- 文案示例：`记忆参考` · `发送前 · 本地检索 · 尚未调用模型`
- 视觉：小号 uppercase / 淡灰，对齐现网 meta 气质

---

## 3. 模式与操作语义

### 3.1 模式（定稿三态）

| 模式 | 用户说法 | 行为 |
|------|----------|------|
| **本轮挑选** | 本轮挑选发送 | 列表默认可勾、**默认全不选**；确认后注入勾选集 |
| **一直开启** | 一直开启引用 | **本 session** 内每轮默认注入相关分 **Top 3**；列表若展示则为预勾锁定预览 |
| **关闭记忆参考** | 本 session 不再提示 · 关闭记忆参考 | **dismiss**：本轮 0 注入直发 + 本 session 不再弹闸门 |

### 3.2 明确删除

| 删除项 | 原因 |
|--------|------|
| **单次开启引用** | 与「本轮挑选」重叠 |
| 右侧策略菜单里的 **关闭** | 与底栏 dismiss 合并，避免两处关闭 |

### 3.3 底栏操作

| 按钮 | 行为 |
|------|------|
| **确认并发送** | pick：带当前勾选（可 0）发送；always：带 Top3 发送 |
| **不选，直接发送** | 本轮强制 0 注入；模式可保持（always 时后续轮次仍可 Top3） |
| **本 session 不再提示 · 关闭记忆参考** | dismissed + 本轮 0 注入 |

### 3.4 切换模式时的列表反馈

| 模式 | 列表标题（示例） | 行状态 | 顶栏 hint（短） |
|------|------------------|--------|-----------------|
| pick | 本轮候选记忆 | 可勾；默认全不选 | 本轮挑选 · 默认全不选 · 点详情看全文 · 仅本次 |
| always | 将自动注入的记忆（Top3 预览） | Top3 勾选锁定 + badge；其余淡化 disabled | 一直开启 · session 内每轮 Top3 · 预勾锁定 |

右侧 **策略说明面板** 必须随模式切换完整文案（见 §5）。

### 3.5 新 session 首次

- workspace **有记忆** 时：首次发送 **强制** 进入本轮挑选 UI 一次。  
- 无记忆：不弹。  
- dismiss 后本 session 不再强制；新 session 再提示。  
- Composer 可重新打开 pick/always。

---

## 4. 布局定稿：C · 列表优先 · 窄策略轨

### 4.1 选型过程（摘要）

| 阶段 | 结论 |
|------|------|
| 初稿 5 变体 | 整体不满意；E 密度尚可 |
| 融入记忆参考菜单后 10 变体 | 用户认 **左右分栏** 信息架构 |
| V2 蓝本 × 5 布局权重 | 用户认 **C 列表优先窄策略轨** |
| C 深耕 | 详情 Dialog + 右侧长文案 + 半屏高度 + 单行列表 |
| 幕布对齐 | 去掉厚外框；用户气泡下挂流；修正时序 |

### 4.2 信息架构

```text
[ 可选：更早的历史消息 … ]

┌ turn-group ─────────────────────────────────────┐
│  [ 用户气泡 · 待发送 ]                    (右对齐) │
│                                                   │
│  ┌ 虚线框：确认/不选 ─┐ 已选 n · …   [dismiss…] │  ← 顶栏强制单行；过长 ellipsis
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  ┌ 左：候选（宽） ──────┬ 右：策略（窄） ──────┐   │
│  │ 标题 + 短 hint        │ ┌ 虚线框 策略菜单 ─┐ │   │
│  │ 单行列表（滚动）       │ │ 本轮挑选/一直开启 │ │   │
│  │                      │ └──────────────────┘ │   │
│  │                      │ 策略长说明（滚动）    │   │
│  └──────────────────────┴──────────────────────┘   │
│  记忆参考 · 发送前 · 匹配完成 · 请选择后发送        │
└───────────────────────────────────────────────────┘

（确认后本区块卸下；若有注入则另呈 memory-context-summary）
```

比例参考：左 : 右 ≈ **1.55 : 0.78**。  
顶栏 / 策略菜单：与 `.memory-pick-gate__toolbar-actions` / `__mode-menu` 虚线框同系（`1px dashed`）。

### 4.3 高度

- 整块挑选区（含底栏）：约 **`max-height: min(48vh, 400px)`**，不超过约半屏。  
- 列表区内部滚动：约 **`min(40vh, 280px)`**。  
- 右侧策略说明内部滚动，**不得**把整页撑得过长。

---

## 5. 右侧策略说明（文案合同）

说明面板随当前模式切换；实现可用 i18n key，语义以下为准。

### 5.1 本轮挑选

**标题**: 本轮挑选发送  

**做什么**

- 只影响这一次发送，不会锁成 session 常开。  
- 左侧默认全不选；勾选后确认才注入。  
- 可点「详情」核对全文再决定。  
- 勾选 0 条 = 本轮不带项目记忆发送。  

**什么时候用**

- 只要某几条约定/踩坑，怕 Top3 噪声。  
- 想先扫一眼再决定。  
- 新 session 首次强制时建立可控习惯。  

**和「一直开启」的差别**

- 本轮：点一次算一次。  
- 一直：session 内每轮默认 Top3。  
- 连续同主题可再切一直开启。  

**底部按钮**

- 确认并发送 / 不选直接发送 / dismiss（见 §3.3）。  

### 5.2 一直开启

**标题**: 一直开启引用（本 session）  

**做什么**

- 本 session 内每轮默认注入相关分最高的 **Top 3**。  
- 列表为预览：Top3 锁定，不可手改；要自选请切回本轮挑选。  

**默认 Top3 规则**

- 按当前用户输入本地检索排序。  
- 同分优先较新。  
- 占用 token，依赖记忆库质量。  

**什么时候用**

- 连续多轮同一主题。  
- 信任排序、不愿每轮勾选。  

**如何关闭**

- 底栏 dismiss。  
- 或改回本轮挑选。  
- 新 session 可再出现首次挑选。  

### 5.3 菜单副文案（短）

| 项 | 副文案 |
|----|--------|
| 本轮挑选发送 | 仅本次 · 手动勾选 |
| 一直开启引用 | 本 session · 默认 Top3 |

---

## 6. 左侧列表与详情

### 6.1 列表行（单行）

```text
[☐]  标题文本…（ellipsis）          0.91  详情
```

- **不要** 在列表行展示 multi-line summary（有详情即可）。  
- `title` 属性可放完整标题 tooltip。  
- always 下 Top 条可带 `Top` badge。  

### 6.2 详情 Dialog

对齐现网 `memory-context-payload-dialog` 心智：

| 区 | 内容 |
|----|------|
| 头 | 标题 · engine/thread/更新时间 · 关闭 |
| 元信息 | 相关分 · kind · importance · tags |
| 正文 | 摘要 · 详情全文 |
| 可选折叠 | 用户原话片段 · 助手摘要片段 |
| 底 | 关闭 · **勾选本条并关闭**（仅 pick；always 禁用） |

交互：遮罩点击 / Esc / 关闭按钮。

---

## 7. 视觉规范（贴合现网幕布）

### 7.1 原则

- **不**用厚重双边框「卡片套卡片」——在现网消息流里会割裂、显丑。  
- 用户气泡：软圆角、弱填充（参考现网 user bubble 灰蓝），**待发送** 小标签。  
- 挑选区：透明底 + **hairline** 顶部分隔；左右用极淡竖线。  
- 列表行：默认无框，hover 浅底，选中浅蓝底。  
- 主按钮：实心/半透明蓝 pill；次按钮弱底；dismiss **下划线文字**，非大红框。  
- 背景：幕布深色（约 `#0b0d10`），与现网一致。  

### 7.2 与注入后展示的关系

- 发送前：Pick 交互流（本文件）。  
- 发送后 k>0：可收敛为既有 **memory-context-summary-card**（关联资源，非用户气泡混排）。  

---

## 8. 与现网 Composer「记忆参考」菜单的关系

| 现网 | 定稿 |
|------|------|
| 关闭 | 无闸门；或 first-pick 后仍可为 pick；**dismiss** 为 session 静音 |
| 单次开启引用 | **删除** → 用本轮挑选 |
| 一直开启引用 | 保留语义，改为 **session Top3 默认注入** |

Composer 控制面需改文案与三态，避免与幕布闸门两套语言。

`@@` 手动选择 **保留**，与 pick 去重。

---

## 9. 无障碍 / 体验细节

- 详情按钮与 checkbox 分区，避免整行误触。  
- pending 态避免同 turn 重复发送。  
- 建议 MVP：取消本轮 → 移除 pending 气泡、回填 Composer。  
- 空检索：不展示空流，直接发送。  
- 超时：直发，可选轻 toast。  

---

## 10. 实现清单（UI 侧）

- [ ] `PickGate` 容器挂在 pending 用户气泡下（timeline / context-stack）  
- [ ] 左列表单行 + 滚动高度限制  
- [ ] 详情 Dialog 组件  
- [ ] 右策略菜单 + 模式切换驱动说明面板  
- [ ] 底栏三操作  
- [ ] always Top3 锁定态  
- [ ] dismissed / firstPick 状态  
- [ ] i18n（策略长文案完整翻译）  
- [ ] 视觉对照金样 HTML 做像素级 diff（气质优先，非 1px 抠）  
- [ ] 与 `memory-context-summary` 确认后衔接  

---

## 11. 金样与变更记录

| 资源 | 说明 |
|------|------|
| `docs/prototypes/memory-pick-gate-ui-variants.html` | C 可交互金样（可能含匹配占位动画等增强，见 §11.1） |
| `proposal.md` | 范围 / 验收 |
| `design.md` | 状态机 / 注入 / 风险 |
| `docs/research/05-project-memory-pick-gate-pointer.md` | research 索引指针 |
| `docs/research/README.md` | Project Memory · Pick Gate 入口 |

### 11.1 金样增强 vs 合同必做

金样 HTML 可能继续迭代交互演示（例如匹配中占位动画、always 倒计时自动确认、历史轮展开已注入）。**合同必做**以本 `ux.md` §2–§9 与 `design.md` 为准；金样中未写入合同的动画/倒计时：

| 增强 | 处理 |
|------|------|
| 检索中占位动画 | **建议 MVP 做**轻量 loading（勿阻塞半屏） |
| always 倒计时自动确认 | **可选**；默认合同可为静默 Top3 或一键确认（见 design Open Questions） |
| 历史轮展开已注入 | **建议**与现网 summary 卡对齐，非闸门阻塞路径 |

**沟通演进（便于后人）**

1. 提出发送前挑选闸门 + session 静音。  
2. 拍板：首次强制、默认全不选、snooze 直发、四模式 → 后改为 **去掉单次、一直 Top3、关闭并入底栏**。  
3. UI 多轮变体 → 定 **C**。  
4. 详情 + 右侧长文案；半屏高度；单行列表。  
5. 对齐现网幕布去厚框；修正 **时序**（去掉待发送上的伪 Assistant）。  

---

## 12. 完整交互矩阵

### 12.1 进入闸门

| 触发 | 前置 | 结果 |
|------|------|------|
| 用户点发送 | firstPick 或 mode=pick，有候选 | 气泡待发送 + retrieving → awaiting-choice |
| 用户点发送 | mode=always，非 firstPick | MVP：静默 Top3 send（无手勾 UI） |
| 用户点发送 | dismissed / 无文本 / 空候选 / 超时 | 无闸门或直发 |
| 用户点发送 | streaming 中 | 忽略或进队列（现网队列策略） |

### 12.2 闸门内

| 操作 | 前置 | 结果 |
|------|------|------|
| 勾选/取消勾选 | pick | selectedIds 更新；计数更新 |
| 点详情 | 任意 | Dialog；pick 可「勾选并关闭」 |
| 切到一直开启 | awaiting | 列表变 Top3 锁定；说明面板切换；selected 语义变 Top3 |
| 切到本轮挑选 | awaiting | 列表可勾；默认清空勾选（或保留用户已选，**默认清空**） |
| 确认并发送 | awaiting | flushSend；卸闸门 |
| 不选直接发送 | awaiting | 0 注入 flushSend |
| dismiss | awaiting | dismissed + 0 注入 flushSend |
| 取消本轮（若有） | awaiting | 移除 pending 气泡；回填 Composer；不 send |
| Esc | Dialog 开 | 关 Dialog |
| Esc | 无 Dialog | 建议 = 取消本轮（MVP） |

### 12.3 闸门后

| 情况 | UI |
|------|-----|
| k>0 注入成功 | 关联资源 summary 卡；用户气泡仅原文 |
| k=0 | 无 summary 卡 |
| always 后续轮 | 无闸门（MVP）；注入 Top3 可有 summary |
| dismiss 后本 session | 无闸门 |
| 新 session | firstPick 再来 |

### 12.4 Composer 菜单

| 选择 | 即时效果 |
|------|----------|
| 关闭 | composerMode=off；不自动清 dismissed |
| 本轮挑选 | composerMode=pick；若 dismissed 可提示「恢复本 session 询问」 |
| 一直开启 | composerMode=always |
| 恢复询问 | dismissed=false（若提供入口） |

---

## 13. 响应式与密度

| 断点 | 布局 |
|------|------|
| 宽（默认幕布） | 左右分栏 1.55:0.78 |
| 窄（&lt;720px 或窄侧栏） | 上下堆叠：列表上、策略下；策略区 max-height 限制滚动 |
| 半屏高度 | 整闸门 `min(48vh, 400px)` 量级；超高内容内部滚 |

列表行高约 32–36px；一屏内尽量可见 ≥4 条候选。

---

## 14. 动效（建议）

| 场景 | 动效 | 优先级 |
|------|------|--------|
| 闸门出现 | 短 fade/slide 16–28ms 量级，勿弹跳 | MVP 可静态 |
| retrieving | skeleton 行或「ccgui 匹配中」占位 | 建议 MVP |
| 勾选 | 行背景过渡 120ms | MVP |
| Dialog | 现网 overlay 模式 | MVP |
| always 倒计时 | 进度环/条 + 可取消 | P1 |

须遵守项目 Render Perf：高频 setState 不进根链；倒计时用局部 state。

---

## 15. 无障碍 a11y

- 闸门区域 `role="region"` + `aria-label="记忆参考挑选"`。  
- 模式菜单：`radiogroup` / `aria-checked`。  
- 列表：checkbox 与「详情」可键盘聚焦；详情 `aria-haspopup="dialog"`。  
- Dialog：焦点陷阱、Esc 关闭、返回焦点到触发按钮。  
- 确认按钮在 awaiting 且非 flushing 时可点；flushing 时 `aria-busy`。  
- 对比度：淡灰文案在 `#0b0d10` 上需可读（策略说明 ≥ 现网 muted 级）。

---

## 16. 空态 / 加载 / 错误（UI）

| 态 | UI |
|----|-----|
| retrieving | 左列表 skeleton 3–5 行；右可保留模式说明 |
| 空候选 | **不展示闸门**（orchestrator 直发） |
| 超时/失败 | 直发；可选底部 toast，不占幕布半屏 |
| detail 失败 | Dialog 内错误 + 重试 |
| 无记忆库 firstPick | 不强制（firstPickRequired=false） |

---

## 17. 文案 key 建议（实现）

```text
memoryPick.role
memoryPick.roleDesc
memoryPick.listTitle.pick
memoryPick.listTitle.always
memoryPick.listHint.pick
memoryPick.listHint.always
memoryPick.count.pick          // 已选 {{n}} · 默认全不选
memoryPick.count.always        // 自动注入 {{k}} 条 · …
memoryPick.mode.pick
memoryPick.mode.pickSub
memoryPick.mode.always
memoryPick.mode.alwaysSub
memoryPick.strategy.pick.*     // 分节标题与条目
memoryPick.strategy.always.*
memoryPick.action.confirm
memoryPick.action.skip
memoryPick.action.dismiss
memoryPick.action.cancel
memoryPick.detail.title
memoryPick.detail.selectAndClose
memoryPick.detail.alwaysLocked
memoryPick.pendingTag          // 待发送
memoryPick.toast.timeout
memoryPick.composer.off
memoryPick.composer.pick
memoryPick.composer.always
memoryPick.composer.sessionMuted
```

策略长文案正文见 §5；实现时拆 bullet 数组进 locale。

---

## 18. 视觉 token（实现对照）

| 用途 | 建议 |
|------|------|
| 幕布底 | `#0b0d10` / 现网 canvas |
| 用户气泡 | 软灰蓝填充，无描边或极淡描边 |
| 待发送 tag | `#93c5fd` 系 10px |
| hairline | `rgba(148,163,184,0.10–0.12)` |
| 选中行 | `rgba(37,99,235,0.12)` |
| always 行 | `rgba(34,197,94,0.08)` |
| 主按钮 | `rgba(37,99,235,0.35)` pill |
| dismiss | 珊瑚淡字 + underline，无红框 |
| 角色条 | 10px uppercase，`rgba(148,163,184,0.45)` |

**禁止**：厚双边框卡片、左侧强色 accent bar 套整闸门、紫渐变 slop。

---

## 19. 评审检查表（UI 验收）

- [ ] 时序：无「Assistant 在待发送气泡上」  
- [ ] 结构：气泡下挂流，无厚外框  
- [ ] 列表：单行 + 详情  
- [ ] 模式：仅本轮 / 一直；无单次；无右侧关闭  
- [ ] 切换模式：左列表与右说明同步  
- [ ] 高度：约半屏内滚动  
- [ ] 底栏：确认 / 跳过 / dismiss  
- [ ] 详情 Dialog 字段完整可滚动  
- [ ] 与现网字体/色板不割裂  
- [ ] 窄宽断点可堆叠  

---

## 20. 产品设计标记（以现网验收为准 · 2026-08-10）

> 以下为用户验收中确认的布局/交互，实现以本段为准覆盖更早工程默认。

| 标记 | 要求 |
|------|------|
| **历史/已注入卡** | 图3 轻量可展开：左对齐、**宽度拉满幕布内容列（min 860）**；折叠一行 + 本轮挑选徽标 |
| **详情** | 行内「详情」必须可弹窗；无 rawPayload 时也展示标题/摘要；弹窗高度 **自适应视口**（约 80–85vh），body 内滚动防裁切 |
| **匹配中 UI** | 紧凑全宽匹配条；查到数据再出选择；**无结果直接过** |
| **位置** | 注入摘要 / 挑选流应在用户气泡 **下一行**，内容列 **左侧**（勿随 user stack 整体右贴） |
| **一直开启** | 每轮：matching → 按 n 预勾（默 3，可改）；**仅闸门以 always 打开时** 8s 读秒（可取消；任意交互打断后本轮不重启）；中途 pick→always 不启动读秒；记 preferred count；禁止静默直发 |
| **详情弹窗** | portal body；仅详情 Markdown；高度 max 85vh，body 滚动；无 header 关闭 icon |
| **宽度** | 匹配条 / 挑选面板：与 `.messages-full` 同列 750px 中栏 |
| **底栏** | icon+文案，非胶囊按钮 |
| **列表** | 行高固定 36px；条目少不撑开 |

## 21. 一句话

> **用户气泡先待发送，其下无框挑选流；本轮手勾或整轮 top(n) 预勾（可改+读秒）；关闭只在底栏 dismiss；确认后才调模型。**

## 22. Phase-1 验收补充（2026-08-10）

与 `design.md` §22–23 对齐；实现细节以代码为准。
