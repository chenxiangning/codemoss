## 1. Baseline and Guardrails (P0)

- [x] 0.1 记录幕布关键链路基线（输入: 当前主干实时/历史行为样本；输出: 基线文档含消息/工具/Plan/UserInput/历史恢复；验证: 能逐项对照回归）
- [x] 0.2 固化三引擎样本集（输入: Codex/Claude/OpenCode 真实线程；输出: 可重复回放样本清单；验证: 每引擎至少 1 条含工具与计划的样本）
- [x] 0.3 建立 feature flags 清单与默认值（依赖: 0.1；输出: `chatCanvasUseNormalizedRealtime`/`chatCanvasUseUnifiedHistoryLoader`/`chatCanvasUsePresentationProfile=false`；验证: 配置可读且默认不改变现网行为）

## 2. Canonical Contracts and Types (P0)

- [x] 1.1 定义 `NormalizedThreadEvent` 与事件字典（输入: 三引擎实时协议；输出: 统一事件类型覆盖 `message/reasoning/diff/review/explore/tool`；验证: TS 类型检查通过）
- [x] 1.2 定义 `NormalizedHistorySnapshot` 及字段约束（依赖: 1.1；输出: 历史快照标准结构；验证: 缺失字段有显式可见 fallback 策略）
- [x] 1.3 定义 `ConversationState` 聚合结构（依赖: 1.1,1.2；输出: `items/plan/userInput/meta` 单一状态源；验证: 渲染层可只消费该结构）
- [x] 1.4 定义 `RealtimeAdapter`/`HistoryLoader`/`ConversationAssembler` 接口（依赖: 1.1,1.2,1.3；输出: 分层接口契约；验证: 旧逻辑可通过适配层接入）
- [x] 1.5 补充契约文档与正反例（依赖: 1.1~1.4；输出: 示例覆盖实时与历史；验证: 开发可按文档实现且无歧义）

## 3. Realtime Adapter Implementation (P0)

- [x] 2.1 实现 `codexRealtimeAdapter`（依赖: 1.4；输出: Codex item/turn/reasoning/tool 归一化；验证: 样本事件映射到标准类型）
- [x] 2.2 实现 `claudeRealtimeAdapter`（依赖: 1.4；输出: Claude session 事件归一化；验证: 映射后无渲染层引擎分支新增）
- [x] 2.3 实现 `opencodeRealtimeAdapter`（依赖: 1.4；输出: heartbeat/non-streaming 归一化；验证: waiting 仅为展示提示不改语义）
- [x] 2.4 将实时入口接入 adapter 层并保留旧开关（依赖: 2.1,2.2,2.3,0.3；输出: 双路径可切换；验证: 关闭新开关后行为与基线一致）
- [x] 2.5 为三引擎 adapter 补单测（依赖: 2.1~2.4；输出: 成功映射/异常输入/降级策略用例；验证: 对应测试通过）

## 4. History Loader Implementation (P0)

- [x] 3.1 实现 `codexHistoryLoader`（依赖: 1.4；输出: resume thread -> normalized snapshot；验证: 历史项可还原到统一语义）
- [x] 3.2 实现 `claudeHistoryLoader`（依赖: 1.4；输出: JSONL session -> normalized snapshot；验证: 顺序与关键状态正确）
- [x] 3.3 实现 `opencodeHistoryLoader`（依赖: 1.4；输出: session restore -> normalized snapshot；验证: 终态语义与实时一致）
- [x] 3.4 缺失字段 fallback normalize + 告警（依赖: 3.1,3.2,3.3；输出: 非 silent fail 的补齐机制；验证: 异常样本可观测并可继续渲染）
- [x] 3.5 为三引擎 loader 补单测（依赖: 3.1~3.4；输出: 字段完整/缺失/异常格式用例；验证: 测试通过）

## 5. Shared Assembler and State Convergence (P0)

- [x] 4.1 实现 `appendEvent` 合并策略（依赖: 1.3；输出: message/reasoning/tool/diff/review/explore 统一增量合并；验证: 顺序稳定且状态转换正确）
- [x] 4.2 实现 `hydrateHistory` 恢复与去重（依赖: 1.2,4.1；输出: 历史恢复统一装配；验证: 重复事件不重复渲染）
- [x] 4.3 实现 `plan`/`userInputQueue`/`threadMeta` 合并（依赖: 4.1,4.2；输出: 单一数据源；验证: Plan 快览与面板一致、UserInput FIFO 且线程隔离）
- [x] 4.4 实现实时/历史一致性白名单（依赖: 4.1~4.3；输出: 可解释差异列表；验证: 非白名单差异会被测试捕获）
- [x] 4.5 产出 assembler 测试矩阵（依赖: 4.1~4.4；输出: 顺序/状态/幂等/边界覆盖；验证: 矩阵对应用例全部通过）

## 6. Curtain Rendering Kernel Wiring (P1)

- [x] 5.1 `Messages` 仅消费 `ConversationState`（依赖: 4.3；输出: 渲染层不直读引擎字段；验证: 代码检索无新增协议字段直读）
- [x] 5.2 保持 `renderEntry` + `renderSingleItem` 分发稳定（依赖: 5.1；输出: 分发入口不变；验证: 现有渲染行为回归通过）
- [x] 5.3 统一 `ToolBlockRenderer` 输入为标准 `tool`（依赖: 5.1；输出: 工具卡仅依赖标准结构；验证: pending/completed/failed 状态一致）
- [x] 5.4 保持 `Markdown` 与消息样式不退化（依赖: 5.1；输出: 含 `codex-canvas` class 的样式兼容；验证: 关键视觉快照/样式检查通过）
- [x] 5.5 引擎视觉差异下沉到 `PresentationProfile`（依赖: 5.2,5.3；输出: profile 承载提示差异；验证: 不新增 item kind 且非 Codex 引擎行为不变）

## 7. Capability Parity and Regression Gates (P1)

- [x] 6.1 Tool 组卡片实时/历史状态一致（依赖: 5.3；输出: 双路径同状态语义；验证: 三引擎样本对比通过）
- [x] 6.2 Plan quick view 与 Plan panel 同源（依赖: 4.3,5.1；输出: 单一计划状态源；验证: 长计划可滚动且无缺项）
- [x] 6.3 UserInput 行为一致（依赖: 4.3,5.1；输出: 线程隔离/FIFO/去重/失败可重试；验证: request 响应往返与历史恢复用例通过）
- [x] 6.4 OpenCode heartbeat 仅影响提示（依赖: 2.3,5.5；输出: 等待态展示逻辑；验证: 不改变会话语义与排序）
- [x] 6.5 Reasoning 标题/正文实时与历史规则一致（依赖: 4.1,4.2,5.1；输出: 统一摘要规则；验证: Codex 标签与详情卡语义一致）

## 8. Test Integration and CI Enforcement (P1)

- [x] 7.1 adapter 层单测纳入 CI（依赖: 2.5；输出: CI 执行 adapter 测试；验证: CI 绿色）
- [x] 7.2 loader 层单测纳入 CI（依赖: 3.5；输出: CI 执行 loader 测试；验证: CI 绿色）
- [x] 7.3 assembler 单测/集测纳入 CI（依赖: 4.5；输出: CI 执行装配测试；验证: CI 绿色）
- [x] 7.4 新增实时 vs 历史一致性回归（依赖: 6.1~6.5；输出: 快照一致性测试；验证: 非白名单差异失败）
- [x] 7.5 补齐幕布关键链路冒烟（依赖: 7.1~7.4；输出: 消息/工具/计划/提问/历史冒烟集；验证: 主链路可用）

## 9. Rollout, Rollback, and Cleanup (P2)

- [x] 8.1 分阶段开启 `chatCanvasUseNormalizedRealtime`（依赖: 7.5；输出: 阶段启用记录；验证: 实时链路稳定）
- [x] 8.2 分阶段开启 `chatCanvasUseUnifiedHistoryLoader`（依赖: 7.5；输出: 阶段启用记录；验证: 历史恢复与实时一致）
- [x] 8.3 分阶段开启 `chatCanvasUsePresentationProfile`（依赖: 7.5；输出: 阶段启用记录；验证: 视觉差异可控且语义不变）
- [x] 8.4 每阶段产出差异报告与回滚预案（依赖: 8.1,8.2,8.3；输出: 对比报告+回滚步骤；验证: 可在单 flag 维度回退）
- [x] 8.5 稳定后清理旧路径与冗余兼容（依赖: 8.4；输出: 删除双路径技术债；验证: 测试与类型检查通过）

## 10. Definition of Done (P1)

- [x] 9.1 三引擎实时/历史 `ConversationItem` 序列达一致性门禁（依赖: 7.4；输出: 一致性报告；验证: 门禁通过）
- [x] 9.2 关键能力回归通过（依赖: 7.5；输出: Tool/Plan/UserInput/Reasoning/OpenCode waiting 回归记录；验证: 全部通过）
- [x] 9.3 feature flags 支持独立回退且功能可用（依赖: 8.4；输出: 回退演练记录；验证: 任一 flag 关闭后主链路可用）
- [x] 9.4 文档齐备（依赖: 9.1,9.2,9.3；输出: 变更文档/设计文档/测试报告/回滚说明；验证: 归档材料完整）
