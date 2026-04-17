## 1. Hidden Runtime Core

- [x] 1.1 [P0][Depends: none][Input: 当前 `useQueuedSend` / `useComposerController` 队列契约][Output: 新增融合动作、runtime capability 判定与线程级 fusion lock 的类型化接口][Verify: TypeScript 无 `any`，调用点全部完成编译收敛] 扩展队列 hook 对外契约，定义 `fuseQueuedMessage`、`canFuseActiveQueue`、融合中状态和 thread-local fusion lock。
- [x] 1.2 [P0][Depends: 1.1][Input: `activeThreadId`、既有 steer/send 逻辑、safe cutover 约束][Output: 单条融合状态机][Verify: hook 单测覆盖 steer 主路径、fallback cutover、失败回滚、原索引恢复、同线程 auto-drain 暂停] 在 `useQueuedSend` 实现“优先 in-run follow-up、必要时 safe cutover、线程锁保护”的融合流程。
- [x] 1.3 [P0][Depends: 1.2][Input: 当前 queued item 结构 `text/images/sendOptions`][Output: payload 保真发送约束][Verify: hook 单测覆盖附件与 sendOptions 不丢失] 确保融合发送复用原排队项完整 payload，不退化为纯文本 resend。
- [x] 1.4 [P0][Depends: 1.1-1.3][Input: 现有 `useQueuedSend` 测试基线][Output: 隐藏能力状态下的自动化门禁][Verify: 在不开放新 UI 的前提下，状态机相关 Vitest 全绿] 先完成隐藏能力阶段测试，确认状态机本身可独立成立。

## 2. Integration Wiring

- [x] 2.1 [P0][Depends: 1.4][Input: `useThreads -> app-shell -> useComposerController` 链路][Output: 融合回调与 safe cutover 所需 `interruptTurn` 能力贯通到 controller][Verify: 集成测试可证明 steer 主路径不会误触 interrupt，fallback 才允许使用 cutover] 将融合动作和必要的 `interruptTurn` fallback 接入 `app-shell` 与 `useComposerController`。
- [x] 2.2 [P0][Depends: 2.1][Input: composer props / layout nodes 接线][Output: 融合 capability flag 与 loading/disabled 状态贯通到 UI 层边界，但默认不开放按钮][Verify: 渲染链路可拿到完整 props，且现有 UI 无可见行为变化] 先完成非可见接线闭环，再进入按钮曝光阶段。

## 3. UI Exposure

- [x] 3.1 [P0][Depends: 2.2][Input: 当前 `MessageQueue` 组件结构][Output: 队列项动作区新增 `融合` + `删除`][Verify: 组件测试覆盖按钮显示、禁用态、回调触发、loading 态] 改造 `MessageQueue.tsx`，在接线稳定后再开放独立融合动作。
- [x] 3.2 [P0][Depends: 3.1][Input: 当前 composer queue/composer input 样式][Output: 统一外层容器与子卡片视觉语言][Verify: 样式回归检查通过，排队区与 composer 圆角/边框一致] 调整队列相关 CSS，完成视觉统一且不破坏输入框焦点和附件区域布局。
- [x] 3.3 [P1][Depends: 3.1][Input: `zh/en` locale 与运行态 capability 边界][Output: 新增“融合”文案与不可用态表达][Verify: i18n 键完整，无硬编码残留；不可用态由 runtime capability 决定而不是硬编码 Codex-only] 补齐本地化文本和可用性文案。

## 4. Validation

- [x] 4.1 [P0][Depends: 1.4,2.2][Input: hook/接线测试清单][Output: Gate A + Gate B 验证结果][Verify: 隐藏能力阶段测试全绿，且 UI 仍无行为变化] 先完成状态机与接线阶段门禁，确认未暴露 UI 前系统已经稳定。
- [x] 4.2 [P0][Depends: 3.1-3.3][Input: 组件/样式/i18n 测试清单][Output: Gate C 验证结果][Verify: `MessageQueue`、`useQueuedSend` 相关 Vitest 用例通过] 增加 steer 主路径、safe cutover fallback、payload 保真、失败恢复、线程隔离、不可用态不伪成功和按钮曝光回归测试。
- [x] 4.3 [P0][Depends: 4.1,4.2][Input: 本 change artifacts 与实现边界][Output: OpenSpec/前端校验结果][Verify: `openspec validate --strict` 与目标前端 typecheck/test 通过] 完成规范校验与实现门禁命令记录，确保该提案可安全进入 apply 阶段。
