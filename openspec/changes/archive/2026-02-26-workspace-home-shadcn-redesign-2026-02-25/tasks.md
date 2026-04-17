## 1. P0 - Spec Delta Completion

- [x] 1.1 新增 `workspace-home-shadcn-ux` delta spec（输入：proposal+design；输出：
  `changes/.../specs/workspace-home-shadcn-ux/spec.md`；验证：仅含 `## ADDED Requirements` 且每个 Requirement 含
  `#### Scenario`）
- [x] 1.2 修改 `workspace-home-opencode-entry` delta spec（依赖：1.1；输入：base spec + redesign 约束；输出：
  `changes/.../specs/workspace-home-opencode-entry/spec.md`；验证：`## MODIFIED Requirements` 中保留原语义并补充可发现性/参数保真）
- [x] 1.3 修改 `workspace-recent-conversations-bulk-management` delta spec（依赖：1.1；输入：base spec + redesign 约束；输出：
  `changes/.../specs/workspace-recent-conversations-bulk-management/spec.md`；验证：管理态/确认态/删除中态可辨识且场景为
  WHEN/THEN）

## 2. P1 - Home Redesign Implementation

- [x] 2.1 重排 `WorkspaceHome.tsx` 为 Hero/Guide/Recent 三段式骨架并复用现有 handlers（依赖：1.1-1.3；输入：design.md；输出：结构化
  JSX；验证：新建/继续/引擎选择链路语义不变）
- [x] 2.2 调整 `WorkspaceHomeSpecModule.tsx` 入口卡片层级与可读文案承载（依赖：2.1；输入：proposal 中 OpenSpec/Spec-kit
  入口要求；输出：等权入口卡片；验证：两入口首屏可达且非仅颜色区分）
- [x] 2.3 重写 `workspace-home.css` 首页命名空间样式，建立浅/深色状态等价映射（依赖：2.1-2.2；输入：design 主题约束；输出：语义化样式
  token 消费；验证：idle/processing/reviewing 与 danger/normal 双主题可区分）

## 3. P1 - Behavior Safeguard Tests

- [x] 3.1 更新 `WorkspaceHome.test.tsx` 以覆盖三段式结构与主 CTA 可达性（依赖：2.1；输入：重构后 DOM；输出：稳定断言；验证：测试通过）
- [x] 3.2 增加/修正 OpenCode 新建与继续会话语义保真测试（依赖：2.1；输入：existing handlers；输出：行为回归测试；验证：
  `engine=opencode` 与继续逻辑断言通过）
- [x] 3.3 增加/修正最近会话批量删除状态可见性测试（依赖：2.3；输入：管理态状态机；输出：管理/确认/删除中断言；验证：全成功/部分失败/防重入覆盖）

## 4. P2 - Visual Polish And Accessibility

- [x] 4.1 微调卡片间距、层级阴影与边框对比（依赖：2.3；输入：UI baseline；输出：生产级视觉节奏；验证：不影响 P1 行为测试）
- [x] 4.2 补充可访问性属性（按钮可访问名、状态文本提示）并校验键盘可达（依赖：2.1-2.3；输入：现有组件语义；输出：a11y
  增强；验证：关键控件可通过键盘触达与识别）

## 5. P1 - Minimum Validation And Traceability

- [x] 5.1 运行最小回归命令（`pnpm vitest run src/features/workspaces/components/WorkspaceHome.test.tsx`
  ）（依赖：3.1-3.3；输入：实现代码；输出：测试结果；验证：目标测试全绿）
- [x] 5.2 运行类型检查（`pnpm tsc --noEmit`）（依赖：2.1-3.3；输入：前端变更；输出：类型检查结果；验证：零 TypeScript 错误）
- [x] 5.3 记录变更与能力点对齐（依赖：5.1-5.2；输入：proposal/spec/tasks；输出：可审计对齐说明；验证：三项 capability 均有实现与测试映射）
