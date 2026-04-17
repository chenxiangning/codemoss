## 1. Scope and capability framing

- [x] 1.1 确认 workspace 下多 session 聚合边界，并固化到 proposal / design
- [x] 1.2 定义“相关 session”判定规则：`active thread -> root thread -> descendants`，并明确主 session、子 session、子 agent session 的纳入条件
- [x] 1.3 明确 capability 命名与 delta specs 归属，避免与现有 `conversation-*` / `codex-chat-canvas-*` 能力交叉失焦

## 2. Spec authoring

- [x] 2.1 新增 `codex-chat-canvas-workspace-session-activity-panel` delta spec，覆盖右侧面板入口、聚合规则、状态语义与跳转契约
- [x] 2.2 修改 `conversation-tool-card-persistence` delta spec，补充 tool card 与 activity panel 的语义一致性和复用边界
- [x] 2.3 修改 `codex-chat-canvas-execution-cards-visual-refactor` delta spec，补充 Codex 执行摘要在实时标签、详情卡片、activity panel 三处共享
- [x] 2.4 审核 spec 场景表述，确保 “MUST / SHOULD / MUST NOT” 约束可以直接转成实现验收

## 3. Data source audit

- [x] 3.1 盘点 workspace 内相关线程 `ConversationItem[]` 中可直接复用的命令、任务、文件修改事件
- [x] 3.2 审核 thread / subagent / session 关系元数据，确认前端能识别主从 session 归属
- [x] 3.3 审核 `sharedRealtimeAdapter` 与历史加载器的一致性，确认实时事件与历史回放口径一致
- [x] 3.4 提炼右侧 activity panel 的统一 multi-session selector / view model，避免复制 status panel 解析逻辑
- [x] 3.5 定义 adapter fallback 规则：仅允许 thread linking 元数据兜底，不允许基于消息文案猜测亲缘关系
- [x] 3.6 为 fallback 纳入的 session 设计显式 provenance 标记，保证 UI 和调试层面可识别“直接关系 / 缺省推断关系”

## 4. UI and interaction design

- [x] 4.1 设计右侧 panel tab 入口与空态 / 运行态 / 完成态
- [x] 4.2 设计 timeline-first 的 activity timeline/card 结构，覆盖命令、任务、文件修改三类核心事件，并可区分 session 来源
- [x] 4.3 设计主 session / 子 session 的分组、标签或时间线关系表达
- [x] 4.4 定义与 diff、file view、runtime console 的跳转关系与边界
- [x] 4.5 定义面板 view model 与 jump target 结构，确保组件树只消费纯数据
- [x] 4.6 定义命令事件轻展开规则：最近输出窗口、错误优先、完整日志跳转
- [x] 4.7 评估 `live edit preview` 是否需要拆成后续单独 capability，而不是塞进本提案第一阶段
- [x] 4.8 固化事件分类：第一阶段以 `command / task / fileChange` 为主，并为 `explore` 提供独立分类，明确排除 `reasoning`
- [x] 4.9 若采用 `SOLO` 承载该能力，定义按钮入口、运行中退出、普通视图恢复与上下文恢复规则

## 5. Validation

- [x] 5.1 补充 selector / panel 级测试，覆盖 workspace 切换、多 session 聚合、事件增量更新与空态
- [x] 5.2 验证右侧 activity panel 与消息区工具卡片、底部 status panel 的摘要一致性
- [x] 5.3 验证子 session / 子 agent 活动能正确并入聚合视图
- [x] 5.4 验证新增 tab 不影响 Git、Files、Search、Memory 等既有右侧面板能力
- [x] 5.5 验证旧 `StatusPanel`、`toolBlocks`、`thread reducer` 无侵入式职责漂移
- [x] 5.6 验证 `SOLO` 视图在运行中可退出，且退出不打断底层 session 执行
- [x] 5.7 验证重新进入 `SOLO` 后能够恢复当前任务的 activity 上下文

## 6. Implementation sequencing

- [x] 6.1 先新增 `src/features/session-activity/*` 模块与 adapter 测试
- [x] 6.2 再扩 `PanelTabs` 和 `useLayoutNodes` 接入新右侧面板
- [x] 6.3 最后做最小 shared helper 抽取，避免提前改动 `useStatusPanelData`
