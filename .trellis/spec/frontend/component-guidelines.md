# Component Guidelines（组件规范）

## 设计原则（Design Principles）

- 单一职责（Single Responsibility）优先：render / state orchestration / data mapping 分离。
- 默认使用 feature-local component，只有稳定复用后再提升到 `components/ui`。
- 大组件拆分时优先抽 hook 和 pure helper，不先抽“过度抽象”的 base component。

## 文件结构建议

1. imports（external -> internal）
2. local types
3. constants
4. pure helper
5. component implementation
6. export

## Props 约束

- 导出组件必须有明确 `Props` type/interface。
- 禁止无语义命名：`data/info/temp`。
- callback 使用 `onXxx`，并声明 payload type。
- nullable 字段显式写 `T | null`，避免隐式 optional。

## Styling 规范

- 当前项目主样式是 `src/styles/*.css` + `className`/`cn()` 组合。
- class 前缀要 feature scoped（如 `git-history-*`、`spec-hub-*`）。
- 大样式文件允许分片 `*.part1.css/*.part2.css`，但必须保持 selector contract 稳定。
- 条件 class 建议复用 `src/lib/utils.ts` 的 `cn()`。

## i18n 规范

- 用户可见文案必须走 `useTranslation().t("...")`。
- 禁止在交互界面硬编码 copy（调试日志除外）。
- 文案 key 变更要同步 `src/i18n/locales/*`。

## Accessibility 基线

- button/input 必须有可访问名称（label/aria-label/title）。
- modal/dialog 必须具备 `role="dialog"` + `aria-modal`（若为 modal）。
- 鼠标可操作项需考虑 keyboard path。

## 常见坏味道（Common Smells）

- 超长 TSX 文件里混入大量 data logic。
- 引入新组件却不加测试或行为验证。
- feature-specific 行为错误提升到 shared UI，导致耦合污染。
