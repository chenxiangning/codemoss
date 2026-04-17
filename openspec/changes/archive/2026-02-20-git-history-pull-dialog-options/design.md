## Context

Git History 顶部联排按钮当前存在交互不一致：`Push` 已二段式，`Pull/Sync/Fetch/Refresh` 仍以直执行为主。
其中 `Sync` 的真实行为是“pull 后 push”，风险高于普通读操作；`Fetch` 与 `Refresh` 的边界又常被误解（前者更新远端引用，后者刷新本地
UI 数据）。
另外，当前代码并不存在 `Pull/Sync/Fetch` 独立操作快捷键，只有面板级快捷键（如打开 Git Sidebar）。

本次设计目标是把四个入口统一为 confirmation-first，并在确认前提供结构化“意图说明”。

## Goals / Non-Goals

**Goals:**

- `Pull/Sync/Fetch/Refresh` 全部采用二段式确认。
- 每个弹窗都展示统一的信息框架：`Intent / Will Happen / Will NOT Happen / Example`。
- Pull 新增参数化配置与选项互斥。
- 执行前不触发副作用，执行后状态反馈一致。

**Non-Goals:**

- 不改动 Push 既有流程。
- 不引入复杂自动化 Git 工作流。
- 不改写 Git History 主布局架构。

## Decisions

### Decision 1: 四按钮统一 confirmation-first

- 决策
    - `Pull/Sync/Fetch/Refresh` 点击后均先开弹窗，确认后执行。
- 理由
    - 统一交互模型，降低误操作与心智切换成本。

### Decision 1.1: 快捷键入口与按钮入口保持同一确认语义

- 决策
    - 当前变更不新增 `Pull/Sync/Fetch` 独立快捷键。
    - 若后续新增快捷键，必须复用“打开确认弹窗”入口，不得直接执行命令。
- 理由
    - 代码现状未提供该类快捷键，本次先收敛按钮路径；同时预设未来约束防止绕过。

### Decision 2: 定义“意图说明区”标准结构

- 决策
    - 所有弹窗复用同一内容结构：Intent / Will Happen / Will NOT Happen / Example。
- 理由
    - 保证信息完整性；用户能快速判断“该不该点确认”。

### Decision 3: Pull 使用“参数编辑 + 命令预期”双层说明

- 决策
    - Pull Dialog 新增 remote/branch/options 编辑，同时在说明区展示最终行为示例。
- 理由
    - 避免“参数可配但后果不透明”。

### Decision 4: Sync 弹窗显式强调“先 pull 后 push”

- 决策
    - Sync Dialog 的 Will Happen 必须明确顺序和结果路径。
    - Sync Dialog 增加 Preflight 摘要（目标分支、ahead/behind、待推送提交示例）。
- 理由
    - Sync 是组合动作，误解成本最高，必须可视化链路。

### Decision 5: Fetch 与 Refresh 做语义分离提示

- 决策
    - Fetch 明确“更新远端引用，不合并”。
    - Fetch Dialog 必须显示本次 fetch 作用域（默认 `all remotes`）。
    - Refresh 明确“仅刷新 UI 数据，不发 Git 网络命令”。
- 理由
    - 这两个动作最易混淆，必须通过对照文案消歧。

### Decision 6: 建立统一 icon 语义映射并强制区分 Fetch/Refresh

- 决策
    - 为四个动作定义固定 icon 映射（Pull/Sync/Fetch/Refresh），并要求按钮与弹窗标题使用同一映射。
    - Fetch 与 Refresh 禁止共用 icon。
- 理由
    - 视觉识别是高频操作的第一入口；icon 冲突会直接放大误触与误判。

### Decision 7: 执行态统一防重入

- 决策
    - 弹窗确认后进入提交态，禁用重复点击与关键输入，完成后统一 toast + 数据刷新策略。
- 理由
    - 降低并发触发和状态错乱概率。

### Decision 8: 弹窗视觉以“高信息密度可读性”为优先目标

- 决策
    - 弹窗采用三段式视觉结构：标题（icon+标题+影响级别）、说明区（四段意图卡片）、操作区（主次按钮）。
    - 说明区保持一致的间距、标题层级和对比度，避免“文字墙”。
    - 补充量化门槛：普通文本对比度至少 4.5:1，关键风险文案首屏可见。
- 理由
    - “UI 精美”在该场景核心是信息清晰与决策效率，而不是视觉装饰。

### Decision 9: 默认兼容优先

- 决策
    - 不改默认命令语义，仅增加确认层与说明层。
- 理由
    - 将回归风险压缩在交互层，不扩散到底层 Git 语义。

## Risks / Trade-offs

- [Risk] 每次操作增加一次确认点击
    - Mitigation: 文案聚焦关键信息，保留 Enter 快速确认路径。
- [Risk] 文案过长影响效率
    - Mitigation: 统一四段式模板 + 每段一行主句，示例可折叠。
- [Risk] Pull 参数和说明区不同步
    - Mitigation: 由同一状态源实时生成 Example 行。
- [Risk] Refresh 被误认为“无意义确认”
    - Mitigation: 明确其用途是“重建 UI 快照”，并强调不会发 Git 网络命令。
- [Risk] Fetch 与 Refresh icon 过于接近导致误点
    - Mitigation: 强制使用不同 icon，并在弹窗标题重复语义说明。
- [Risk] 说明文本过长导致可读性下降
    - Mitigation: 说明区卡片化 + 每段首句固定模板 + 示例默认精简可展开。
- [Risk] 快捷键路径绕过确认
    - Mitigation: 本次不引入新快捷键；未来若引入，强制复用“打开确认弹窗”分支。
- [Risk] Sync 预览缺失导致误推送
    - Mitigation: 执行前强制展示 Preflight 摘要并写入测试断言。

## Migration Plan

1. 抽象通用确认弹窗信息块组件（Intent/Will Happen/Will NOT Happen/Example）。
2. Pull：新增参数配置区，接入意图说明区与最终行为示例。
3. Sync：新增确认弹窗，描述 pull->push 执行链路。
4. Fetch：新增确认弹窗，描述 fetch 范围与非合并语义。
5. Refresh：新增确认弹窗，描述 UI 刷新范围与无网络命令语义。
6. 落地统一 icon 映射并完成按钮/弹窗标题对齐。
7. 接入统一执行态与取消语义，补 i18n。
8. 增加测试并跑质量门禁。

回滚策略：

- 前端回滚为四按钮直接调用既有 `runOperation(...)`。
- 后端命令无需回滚（语义未改，调用路径可复用）。

## Open Questions

- 示例说明是否需要“展开查看完整命令”与“默认简版命令”两档展示？
- Refresh 弹窗是否需要“本次将刷新哪些数据块”的可配置勾选（后续迭代）？
