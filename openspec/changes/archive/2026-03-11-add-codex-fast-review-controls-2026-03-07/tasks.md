## 1. UI入口与交互结构（P0）

- [x] 1.1 在 `ConfigSelect` 增加 Codex 专属 `Speed` 行与二级菜单（`Standard`/`Fast`），并保持与现有 submenu 机制一致。
- [x] 1.2 在 `ConfigSelect` 增加 Codex 专属 `Review` 快捷入口，点击触发 `/review` 等价动作。
- [x] 1.3 扩展 `ButtonArea`、`ChatInputBoxFooter`、`ChatInputBoxAdapter` 的 props 透传，支持 `Speed` 与 `Review` 新回调和状态。
- [x] 1.4 实现 `Speed` 选中态展示（含 `unknown` 回退策略），确保非 Codex 引擎隐藏 `Speed`/`Review` 入口。

## 2. 命令分发与状态同步（P0）

- [x] 2.1 在 `useQueuedSend` 的 slash command 解析中新增 `/fast`，并按 Codex 路由到 `startFast`。
- [x] 2.2 在 `useThreadMessaging` 新增 `startFast(text)`，支持 `/fast on`、`/fast off` 与无参 toggle 兼容行为。
- [x] 2.3 将 `ConfigSelect` 的 `Speed` 选择动作桥接到命令链路，避免本地状态与引擎状态漂移。
- [x] 2.4 保持 `/review` 文本命令原链路不变，新增 GUI 入口仅复用既有 `startReview(/review)`。

## 3. Review三级流程保障（P0）

- [x] 3.1 校验并补齐 `Review` 二级 preset 层的 4 项入口：base branch / uncommitted changes / commit / custom instructions。
- [x] 3.2 确保 preset 选择 `Review against a base branch` 后进入第三级 `Select a base branch` 列表并支持搜索。
- [x] 3.3 确保 preset 选择 `Review a commit` 后进入第三级 `Select a commit to review` 列表并支持搜索。
- [x] 3.4 确保 preset 选择 `Review uncommitted changes` 时直接启动 review，不进入第三级列表。

## 4. 文案与自动化测试（P1）

- [x] 4.1 在 `i18n/locales/en.ts` 与 `zh.ts` 增加 `Speed`、`Standard`、`Fast`、`Review` 相关文案键值。
- [x] 4.2 更新 `ConfigSelect` 组件测试：覆盖 Codex-only 可见性、`Speed` 子菜单选择、`Review` 快捷触发。
- [x] 4.3 更新 `useQueuedSend` 测试：覆盖 `/fast` 解析与路由，验证非 Codex 行为边界。
- [x] 4.4 补充/更新 review 相关测试，覆盖“二级 preset + 两条第三级目录”行为约束。

## 5. 验证与回归门禁（P0）

- [x] 5.1 执行 `pnpm vitest run src/features/composer/components/ChatInputBox/selectors/ConfigSelect.test.tsx` 并记录结果。
- [x] 5.2 执行 `pnpm vitest run src/features/threads/hooks/useQueuedSend.test.tsx` 并记录结果。
- [x] 5.3 执行与 review 流程相关的目标测试并记录结果。
- [x] 5.4 执行 `pnpm tsc --noEmit`，确保 TypeScript 零错误。
- [x] 5.5 完成手工回归：Codex 下验证 `Speed` 与 `Review`，非 Codex 下验证入口隐藏。

## 6. 边界守卫与最小改动策略（P0）

- [x] 6.1 在实现前列出“允许修改文件白名单”，核心限定在 `ConfigSelect`、ChatInputBox 透传链路、`useQueuedSend`、`useThreadMessaging`、i18n 与测试；额外仅增加最小接线文件 `useComposerController`、`useThreads`、`App`。
- [x] 6.2 为所有新入口与新命令分支添加 `isCodexProvider` / Codex 引擎守卫，确保非 Codex 路径零行为变化。
- [x] 6.3 禁止对 `ReviewInlinePrompt` 和非 Codex 发送链路做结构性重构；若发现必须改动，先补充变更说明再实施。
- [x] 6.4 在 MR/提交说明中显式记录“未改动的遗留模块清单”和“仅新增分支点位”，作为回归审计依据。

## 执行记录（2026-03-07）

- 已完成自动化验证：
  - `pnpm vitest run src/features/composer/components/ChatInputBox/selectors/ConfigSelect.test.tsx src/features/threads/hooks/useQueuedSend.test.tsx src/features/threads/hooks/useThreadMessaging.test.tsx` 通过（67 tests）。
  - `pnpm tsc --noEmit` 通过。
- 已新增/调整的关键分支点位（仅 Codex 引擎相关）：
  - `ConfigSelect` 新增 `Speed` 子菜单与 `Review` 快捷入口（Codex-only）。
  - `useQueuedSend` 新增 `/fast` 解析并路由到 `startFast`（Codex-only）。
  - `useThreadMessaging` 新增 `startFast(text)` 命令桥接。
- 本次显式未做结构性重构：
  - 未改 `ReviewInlinePrompt` 结构。
  - 未重构非 Codex 发送链路。
- 增补修复（2026-03-07 晚）：
  - 在 `Composer` 的 `ChatInputBoxAdapter` 渲染路径补齐 `ReviewInlinePrompt` 显示（仅 `codex` 引擎），修复“点击 `Review` 后已触发 `/review` 但看不到 preset 四选项”的可见性缺口。
- 增补修复（2026-03-07 夜）：
  - 在 `ReviewInlinePrompt` 的 `baseBranch`/`commit` 第三级步骤新增搜索输入框，支持按关键字过滤分支与提交列表。
  - 新增组件测试 `ReviewInlinePrompt.test.tsx`，覆盖“分支搜索可过滤并可选中”、“提交搜索可过滤并可选中”。
  - 自动化验证通过：
    - `pnpm vitest run src/features/composer/components/ReviewInlinePrompt.test.tsx src/features/composer/components/Composer.status-panel-toggle.test.tsx src/features/composer/components/ChatInputBox/selectors/ConfigSelect.test.tsx`
    - `pnpm tsc --noEmit`
- 增补修复（2026-03-07 深夜）：
  - 修复 `ReviewInlinePrompt` 键盘事件链路未接通问题：将 `onReviewPromptKeyDown` 透传到弹层，并在弹层打开期间挂载窗口级 keydown 监听（capture）。
  - 恢复 `Enter` / `ArrowUp` / `ArrowDown` / `Escape` 在 review preset 与第三级选择流中的可用性，避免“只能鼠标点击开始审查按钮”。
  - 新增测试覆盖键盘事件透传：`ReviewInlinePrompt.test.tsx`。
- 增补修复（2026-03-07 深夜二）：
  - 修复 `Review failed to start: invalid thread id ...`：在 `useThreadMessaging.startReviewTarget` 增加 review 专用线程边界校验。
  - 当当前线程属于 `claude/opencode`（或线程 id 与 codex 不兼容）时，自动重绑定到新建 `codex` 线程后再调用 `start_review`，避免把 `claude:*` 线程 id 传给 codex review RPC。
  - 新增回归测试：`useThreadMessaging.test.tsx` 覆盖“active 线程为 `claude` 时，`/review` 会重绑定至 codex 线程并成功启动”。
  - 自动化验证通过：
    - `pnpm vitest run src/features/threads/hooks/useThreadMessaging.test.tsx`
    - `pnpm tsc --noEmit`
- 增补修复（2026-03-07 深夜三）：
  - 仅做 `ReviewInlinePrompt` UI 微调，不改 review 业务逻辑：
    - 缩小弹层宽高并压缩间距，降低视觉占用。
    - 将第三级步骤中的“大按钮”改为 `icon + 文本` 轻操作条（返回 / 开始审查 / 关闭）。
    - 将预设项与列表项选中态从“描边强调”改为“背景高亮 + 轻描边”。
    - 分支/提交列表改为紧凑密度（行高、padding、间距下调）。
  - 自动化验证通过：
    - `pnpm vitest run src/features/composer/components/ReviewInlinePrompt.test.tsx`
    - `pnpm tsc --noEmit`
- 增补修复（2026-03-07 深夜四）：
  - 调整 `ReviewInlinePrompt` 列表选中态视觉：提升背景高亮强度、边框对比度，并在选中项右侧显示 check 图标。
  - 提交列表标题行改为“标题 + check”布局，增强当前选中项可识别性（参考卡片选中风格）。
  - 自动化验证通过：
    - `pnpm vitest run src/features/composer/components/ReviewInlinePrompt.test.tsx`
    - `pnpm tsc --noEmit`
- 增补修复（2026-03-07 深夜五）：
  - 调整 `ReviewInlinePrompt` 操作条布局：`返回` 与 `开始审查` 从两端分布改为左对齐紧凑一排，减少中间留白。
  - 自动化验证通过：
    - `pnpm vitest run src/features/composer/components/ReviewInlinePrompt.test.tsx`
    - `pnpm tsc --noEmit`
- 增补修复（2026-03-07 深夜六）：
  - 将 `返回/开始审查` 操作条上移到头部区域（标题区下方），与下方选择器区域解耦，避免内容区挤压。
  - 为 preset/分支/提交可点击项补充左键 `mousedown` 防丢焦处理，修复“左键点击不稳定/无法选中”问题。
  - `selected` 的 check 图标增加 `pointer-events: none`，避免图标层拦截点击命中。
  - 自动化验证通过：
    - `pnpm vitest run src/features/composer/components/ReviewInlinePrompt.test.tsx`
    - `pnpm tsc --noEmit`
- 增补修复（2026-03-07 深夜七）：
  - 头部操作布局微调：将 `返回/开始审查` 放置到 `关闭` 左侧，同一行展示（操作在前，关闭在后）。
  - 保持选择器区域在下方，不改变 review 业务行为。
  - 自动化验证通过：
    - `pnpm vitest run src/features/composer/components/ReviewInlinePrompt.test.tsx`
    - `pnpm tsc --noEmit`
- 增补修复（2026-03-07 深夜八）：
  - 修复列表鼠标选择体验：`hover` 仅更新高亮态（active），`click` 才更新选中态（selected），避免“鼠标移动就改选中/点击无感”。
  - 移除会干扰点击命中的 `mousedown preventDefault`（preset 与列表项），恢复稳定左键选择。
  - 视觉精修：头部 action 改为轻量 pill 风格，列表项增加 `hover/active/selected` 分层反馈与过渡动画。
  - 新增回归测试：`hover` 不触发选中，`click` 才触发 `onSelectCommit`。
  - 自动化验证通过：
    - `pnpm vitest run src/features/composer/components/ReviewInlinePrompt.test.tsx`
    - `pnpm tsc --noEmit`
- 增补修复（2026-03-07 深夜九）：
  - `ReviewInlinePrompt` 预设第一项文案改为同排紧凑展示：`对比基础分支审查（PR 风格）`，减少纵向留白。
  - 弹层标题前新增 review 语义图标（`codicon-git-pull-request-reviewer`），强化模块识别度。
  - 自动化验证通过：
    - `pnpm vitest run src/features/composer/components/ReviewInlinePrompt.test.tsx`
- 增补修复（2026-03-07 深夜十）：
  - `ReviewInlinePrompt` 按钮与列表改为去背景化、去整框化：统一为透明底，仅保留下边线。
  - 交互强调色切换为 teal 线色体系（默认线/hover 线/selected 线三档），提升轻量感与专业感。
  - 自动化验证通过：
    - `pnpm vitest run src/features/composer/components/ReviewInlinePrompt.test.tsx`
- 增补修复（2026-03-07 深夜十一）：
  - 按用户反馈否定上一版线条风后，重做 `ReviewInlinePrompt` UI 视觉方案（仅 CSS，不改行为逻辑）。
  - 新方案为“专业卡片化 + 柔和强调”：
    - 头部标题/操作区统一圆角轻按钮风格；
    - 输入框、预设项、列表项恢复卡片底和细边框；
    - 选中态采用低饱和强调底色 + 清晰边框 + check 图标；
    - 间距与字号重新平衡，提升整体精致度。
  - 自动化验证通过：
    - `pnpm vitest run src/features/composer/components/ReviewInlinePrompt.test.tsx`
- 增补修复（2026-03-07 深夜十二）：
  - 基于用户指令切换为“轻盈版”视觉：降低背景权重、细化描边、减弱选中态饱和度，保持专业但更轻。
  - 统一压缩间距与字重，提升轻量感（header/toolbar/input/list 同步调整）。
  - 自动化验证通过：
    - `pnpm vitest run src/features/composer/components/ReviewInlinePrompt.test.tsx`
- 增补修复（2026-03-07 深夜十三）：
  - 头部操作按钮改为纯 `icon + 文本` 轻交互样式（去除按钮底与边框，保留语义与状态色）。
  - 修复分支/提交列表鼠标移出后的“高亮背景残留”：列表 `mouseleave` 时将高亮索引恢复到当前已选项。
  - 弱化 `is-active` 背景，仅保留轻边框提示，避免与 `is-selected` 冲突。
  - 新增回归测试：`restores highlight to selected commit after mouse leave`。
  - 自动化验证通过：
    - `pnpm vitest run src/features/composer/components/ReviewInlinePrompt.test.tsx`
