## 1. Header entry and lock wiring

- [x] 1.1 [P0][无依赖] 在 `MainHeader` 增加锁头按钮入口与回调透传。
- [x] 1.2 [P0][依赖 1.1] 在 `useLayoutNodes`/`App.tsx` 贯通 `onLockPanel` 并挂载锁屏遮罩。

## 2. Password file flow (`pwd.txt`)

- [x] 2.1 [P0][无依赖] 密码存储切换为 `~/.codemoss/client/pwd.txt`，默认值 `123456`。
- [x] 2.2 [P0][依赖 2.1] 解锁校验：正确解锁、错误提示并保持锁定。
- [x] 2.3 [P0][依赖 2.1] 文件缺失容错：允许解锁并自动创建默认密码文件。
- [x] 2.4 [P1][依赖 2.1] 锁屏页显示密码文件位置说明（引导人工编辑）。

## 3. Lock overlay UI and content

- [x] 3.1 [P0][依赖 1.2] 新建独立 `LockScreenOverlay`（避免污染主流程）。
- [x] 3.2 [P1][依赖 3.1] 锁屏页 tab 化：实时会话 / 能力图谱 / 交付流程 / 元素介绍。
- [x] 3.3 [P1][依赖 3.1] 配色与系统主题联动，接入 icon，优化桌面与移动布局。

## 4. Live session stream in lock page

- [x] 4.1 [P0][依赖 3.1] 实时会话仅展示运行中输出（不显示历史）。
- [x] 4.2 [P1][依赖 4.1] 卡片高度按数量自适应（1 条占满，2 条等分，更多滚动）。
- [x] 4.3 [P1][依赖 4.1] 自动滚动与内容预览优化（流式输出可读）。

## 5. Session completion bubble (main page)

- [x] 5.1 [P0][无依赖] 右下会话完成提醒气泡：手动关闭 / 跳转会话，不自动消失。
- [x] 5.2 [P0][依赖 5.1] 同 session 唯一提醒：新完成覆盖旧提醒。
- [x] 5.3 [P1][依赖 5.1] 视觉压缩优化：icon 操作、标题带时间、项目/会话前缀、更紧凑布局。
- [x] 5.4 [P1][依赖 5.1] 与 update toast 自动避让，避免右下重叠。

## 6. Completion detection robustness

- [x] 6.1 [P0][无依赖] 完成事件采用多信号判定：`isProcessing`、`lastDurationMs`、`lastAgentMessage.timestamp`。
- [x] 6.2 [P0][依赖 6.1] 初始化防误报 + 连续完成覆盖稳定性修复。
- [x] 6.3 [P1][依赖 6.1] 会话文案改为最新输出片段（非固定首次标题）。

## 7. i18n and regression

- [x] 7.1 [P1][依赖 3~6] 补齐 `zh/en` 文案并清理废弃键。
- [x] 7.2 [P0][依赖 1~7] 执行 `npm run typecheck` 与 `npm run build`，确保回归通过。
