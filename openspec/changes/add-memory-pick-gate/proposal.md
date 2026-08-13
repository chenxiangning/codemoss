## Why

项目记忆已有采集库存与消费入口（`@@` 手动选择、Composer Memory Reference 的 single / always 自动 Scout 注入），但 **匹配结果不可见、不可否决**，用户不敢开、开了也不敢信，导致「有数据却用不起来」。需要在发送链路增加 **半自动闸门：本地检索 → 幕布多选确认 → 再调模型**，在不回到静默注入的前提下恢复可控消费。

**2026-08-10 定稿**：UI/UX 对齐 C 样式。  
**2026-08-10 实现校准**：always 非静默（每轮预览 + 读秒）。  
**2026-08-10 Phase-1 收口**：以工作区代码二次校准——always **可改预勾 n 并记忆**；详情 portal+Markdown；底栏 icon 文案；列表固定行高；幕布↔Composer 同步；侧栏 strip pack。

## 目标与边界

### 目标

1. **Native 与 Shared** 统一 **Memory Pick Gate**：用户点发送后 **用户气泡先上屏（待发送）**，其下挂本地检索候选流，确认前 **不调模型**。
2. 记忆参考收敛为：
   - **本轮挑选**（默认全不选，手勾后注入）
   - **一直开启 / 整轮 top(n)**（本 session 每轮预勾 n 条，默 3，可改；确认后记住 n）
   - **关闭记忆参考**（与「本 session 不再提示」合并为 dismiss）
3. **去掉「单次开启引用」**。
4. **新 session 首次**（workspace 有记忆时）强制走本轮挑选一次。
5. 注入 `source="memory-pick"`；与 `manual-selection` id 去重。
6. UI：**C · 列表优先 · 窄策略轨**；详情 Dialog portal + 仅详情 Markdown；gate 与主消息列同宽（750px）。
7. always：**每轮 matching + 预勾 n（可改）**；**仅以 always 进入 awaiting 时** 8s 读秒自动确认（可取消；任意交互打断后本轮不重启）；**不锁死勾选**。

### 边界

- 仅改 **消费侧发送前** 交互与状态；不改记忆入库 ABCD、存储 schema、跨 workspace。
- 检索复用 workspace 隔离 list/scout/lexical。
- 闸门挂在 **主幕布时间线、用户待发送气泡之下**。

## 非目标

- 不恢复静默自动注入。
- 不改 shared recovery 协议本体。
- 不做 collab worker 独立 Pick 扇出。
- 不做「不相关」反馈 / 重排序训练（P2）。
- 不保留「单次」模式；右侧策略菜单不放独立「关闭」。
- Phase-1 **不**持久化 session policy（刷新丢失 accepted）。

## What Changes

- 发送拦截：pending bubble → 检索 → 幕布 Pick → confirm/skip/dismiss → send。
- Composer：`off | pick | always`；single→pick；幕布模式切换同步菜单。
- 幕布 C UI：左列表（固定行高）+ 详情 Dialog；右策略；底栏 icon+文案。
- pack `source="memory-pick"`；`@@` 去重。
- 空/超时/错误：auto-skip 不卡死。
- 侧栏标题剥离 `project-memory-pack`。
- 测试与 i18n（多 locale）。

## Capabilities

### New Capabilities

- `memory-pick-gate`: 发送前挑选闸门、时序、dismiss、firstPick、Native/Shared 对齐、`memory-pick` 注入。

### Modified Capabilities

- `project-memory-consumption`: pick / always(top n) / dismiss。
- `composer-manual-memory-reference`: 本轮 / 一直 / 关闭。

## Impact

| 层 | 影响面 |
|----|--------|
| Frontend | messaging 编排；PickGate UI；Composer 菜单；session 内存 policy |
| Presentation | 注入与用户气泡分离；summary 卡 |
| Backend | 无强制新 command |
| Specs / Docs | openspec change + ux + prototype |
| Tests | policy / gate / messaging / 标题 strip |

## 技术方案对比（提案级）

| 方案 | 描述 | 取舍 |
|------|------|------|
| **A. 发送前闸门（选用）** | 用户气泡先上屏 → 幕布多选 → 再 send | 可控、可感 |
| **B. 仅增强 Auto Scout 透明度** | 发送后展示不可改 | 解决不了「不敢开」 |
| **C. 仅强化 `@@`** | 必须手动搜选 | 门槛更高 |

**选用 A**。

## 验收标准（Phase-1）

1. 有候选且需闸门：**先用户气泡，再挑选流**；确认前不调模型。
2. pick 默认 0 勾；确认 k 条 → pack source=memory-pick。
3. skip = 0 注入；dismiss = session 静音 + 本轮 0。
4. 新 session 首次（有记忆）强制 pick 一次。
5. always：按 n 预勾（默 3，可改）；以 always 进入 awaiting 才读秒 8s（可取消；交互打断本轮不重启）；确认后下轮同 n。
6. 空/超时：auto-skip 不卡死。
7. Native / Shared / Collab 首段同入口。
8. UI：无厚框；36px 行；icon 底栏；详情 portal+Markdown（无摘要分区）。
9. 侧栏标题为用户输入，非 `<project-memory-pack`。
10. 幕布切策略，Composer 菜单同步。

## 已拍板产品 / UX 决策

| # | 决策 | 来源 |
|---|------|------|
| 1 | 新 session 首次强制 Pick 一次 | 产品 |
| 2 | 本轮挑选默认全不选 | 产品 |
| 3 | 不再提示 = snooze + 本轮 0 | 产品 |
| 4 | 去掉单次；always = 每轮 UI + top(n) | 产品 + 实现 |
| 5 | 关闭并入底栏 dismiss | 产品 |
| 6 | 先用户气泡再挑选流 | 时序 |
| 7 | UI C 列表优先窄策略轨 | 选型 |
| 8 | 列表单行 + 详情 Dialog | UX |
| 9 | always **不锁勾选**；记 preferred count | Phase-1 验收 |
| 10 | 详情仅正文 Markdown；底栏 icon 文案 | Phase-1 polish |

## 指导文档索引

| 文档 | 用途 |
|------|------|
| 本文件 `proposal.md` | Why / 边界 / 验收 |
| `design.md` | 状态机、DTO、UI、校准 §22–23 |
| `ux.md` | UI/UX 定稿 |
| `docs/prototypes/memory-pick-gate-ui-variants.html` | 金样 |
| `tasks.md` | 勾选与 commit 清单 |
| `specs/**` | 行为合同 |
