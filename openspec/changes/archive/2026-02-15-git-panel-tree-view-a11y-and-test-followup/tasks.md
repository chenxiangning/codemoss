# Implementation Tasks: Git Panel Tree View A11y & Tests Follow-up

## 1. 可用性增强

- [x] 1.1 键盘导航（`↑↓←→`、`Enter`）
- [x] 1.2 切换视图快捷键（完成冲突检查后落地）
- [x] 1.3 基础无障碍属性（`aria-label` / `aria-expanded` / `aria-selected`）

## 2. 测试补齐

- [x] 2.1 为树构建逻辑添加单元测试
- [x] 2.2 为视图切换与焦点行为添加组件测试
- [x] 2.3 添加回归测试覆盖 flat 模式核心链路
- [ ] 2.4 手工验证大变更集性能表现并记录结论

## 3. 验证

- [x] 3.1 执行 `openspec validate git-panel-tree-view-a11y-and-test-followup --strict`
