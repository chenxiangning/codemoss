## 1. Spec

- [x] 1.1 创建 change 基础文件（proposal/design/tasks/.openspec.yaml）
- [x] 1.2 新增 capability delta：`codex-chat-canvas-usage-overview`

## 2. Implementation

- [x] 2.1 打通 `accountRateLimits/usageShowRemaining/onRefreshAccountRateLimits` 到 `ConfigSelect`
- [x] 2.2 在 `ConfigSelect` 新增仅 codex 显示的“实时用量”入口
- [x] 2.3 新增 usage 子菜单面板与刷新交互
- [x] 2.4 增补 i18n 文案键（zh/en）
- [x] 2.5 在 `ComposerInput` 增加 codex 专属 `default/plan` 开关
- [x] 2.6 在输入区右侧增加当前模式徽标并与开关同步

## 3. Validation

- [x] 3.1 运行 ChatInputBoxAdapter 相关测试
- [x] 3.2 运行 TypeScript 检查
- [ ] 3.3 手动验证：codex 显示、非 codex 隐藏、刷新可用
- [ ] 3.4 手动验证：`default/plan` 开关仅 codex 可见、切换行为正确
