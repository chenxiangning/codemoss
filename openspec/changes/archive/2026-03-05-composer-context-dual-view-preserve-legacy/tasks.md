## 1. 开关与透传接线（P0）

- [x] 1.1 [P0][depends: none][I: 现有会话与设置状态][O: dual-view enable flag 可读取][V: 启用/关闭开关时 Composer props 变化可观测] 在 Composer 链路增加 `contextDualViewEnabled` 开关透传（App → layout hooks → Composer）。
- [x] 1.2 [P0][depends: 1.1][I: activeTokenUsage + 开关状态][O: 统一 dual-view 输入模型][V: 日志/测试可断言 used/contextWindow/percent 与开关状态一致] 增加 `DualContextUsageModel` 适配层，输出新旧视图共用展示数据。

## 2. 并排视图渲染（P0）

- [x] 2.1 [P0][depends: 1.2][I: legacy ContextBar/TokenIndicator][O: legacy 渲染路径保持不变][V: 开关关闭时 DOM 与行为与旧版一致] 在 Adapter 层保持 legacy-only 渲染分支不变。
- [x] 2.2 [P0][depends: 2.1][I: DualContextUsageModel][O: 新视图组件挂载][V: 开关开启时 legacy + new 同屏可见] 新增 new context view 并在开关开启时与 legacy 并排渲染。
- [x] 2.3 [P0][depends: 2.2][I: compacting/compacted 状态][O: 新视图状态文案展示][V: 三种状态（有值/无值/压缩态）均有正确展示] 为新视图补齐 loading/empty/compaction 状态分支。

## 3. 响应式与回退保障（P1）

- [x] 3.1 [P1][depends: 2.2][I: 宽屏/窄屏布局约束][O: 响应式降级样式][V: 窄屏下无关键文案遮挡且发送主交互可操作] 为并排布局增加窄屏降级策略（单列或 legacy 优先）。
- [x] 3.2 [P0][depends: 2.2][I: feature flag 开关][O: 回退到 legacy-only][V: 关闭开关后不需后端改动即可恢复旧路径] 实现开关级回退路径并验证无协议依赖。

## 4. 测试与质量门禁（P0）

- [x] 4.1 [P0][depends: 2.3][I: ChatInputBoxAdapter/Composer 现有测试][O: dual-view 单测覆盖][V: 覆盖开关关/开、状态显示、窄屏降级] 补充/更新前端单测。
- [x] 4.2 [P0][depends: 4.1][I: i18n 文案文件][O: 新增文案键中英文齐全][V: 不出现缺失 key 告警] 补齐 `en/zh` 文案与可访问性文本。
- [x] 4.3 [P0][depends: 4.1,4.2][I: 仓库现有质量命令][O: 可交付构建状态][V: typecheck/test 通过；无新增 error] 执行质量门禁命令并记录结果。

## 5. 交付与介入测试支持（P0）

- [x] 5.1 [P0][depends: 4.3][I: 任务执行结果][O: 交付说明 + 风险点 + 回退步骤][V: 可按步骤人工复现与回退] 输出交付摘要（变更点、影响面、风险、回退）。
- [x] 5.2 [P0][depends: 5.1][I: 你的介入测试场景][O: 测试检查清单][V: 覆盖开关切换、状态一致性、窄屏可用性] 提供人工介入测试 checklist，等待你介入验证。

## 6. 追加范围收敛：仅 Codex 引擎（P0）

- [x] 6.1 [P0][depends: 5.2][I: App/layout/composer 透传链路][O: codex-only 启用条件][V: 非 codex 场景 data-dual-enabled=false] 将 dual-view 启用条件收敛为 codex 引擎，不影响其它引擎渲染路径。
- [x] 6.2 [P0][depends: 6.1][I: settings/tauri/types 扩展项][O: 无全局新增配置字段][V: Settings 不新增 dual-view 开关，AppSettings 不新增该字段] 移除跨引擎全局配置面改动，避免非 codex 影响面扩大。
- [x] 6.3 [P0][depends: 6.1][I: context tooltip UI][O: 明细文案化展示][V: tooltip 仅展示“总消耗/上下文/状态”明细，无额外进度条] 固化 codex 总览与 tooltip 表达，保持“圆圈 + 气泡明细”方案。
- [x] 6.4 [P0][depends: 6.1,6.2,6.3][I: 现有单测与类型检查][O: 回归通过][V: 指定测试通过且无新增 type error] 执行最小回归验证并记录结果。
