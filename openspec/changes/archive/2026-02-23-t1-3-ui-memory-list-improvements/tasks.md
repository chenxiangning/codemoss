# Implementation Tasks: T1-3 UI Memory List Improvements (Code-Aligned)

## 1. 文档基线修复（以代码为准）

- [x] 1.1 将提案中的技术栈描述从旧 Vue 路径修正为 React + TypeScript
- [x] 1.2 对齐真实组件路径（`ProjectMemoryPanel.tsx`）与样式路径（`project-memory.css`）
- [x] 1.3 对齐真实国际化路径（`src/i18n/locales/zh.ts`、`src/i18n/locales/en.ts`）
- [x] 1.4 在 proposal 中移除“反选按钮”要求，改为当前按钮模型

## 2. i18n 能力对齐

- [x] 2.1 对齐 Kind 显示策略：`project_context`/`conversation`/`code_decision`/`known_issue`/`note`
- [x] 2.2 对齐 Importance 显示策略：`high`/`medium`/`low`
- [x] 2.3 对齐未知值降级策略：显示原始值，不阻塞渲染
- [x] 2.4 增加组件级测试，覆盖语言切换时的渲染更新（`ProjectMemoryPanel.test.tsx`）

## 3. 按钮布局与交互对齐

- [x] 3.1 对齐底部统一操作区：批量区（左）+ 主操作区（右）
- [x] 3.2 对齐批量按钮集合：全选/取消全选、批量设高/中/低、批量删除
- [x] 3.3 对齐主操作按钮：保存、删除
- [x] 3.4 对齐图标策略：关键按钮有图标（全选/取消全选/批量删除/保存/删除）
- [x] 3.5 对齐状态策略：保存中禁用、批量处理中禁用、无选中时隐藏批量动作
- [x] 3.6 增加组件级测试，覆盖批量操作按钮显隐与禁用逻辑（`ProjectMemoryPanel.test.tsx`）

## 4. 分页简化对齐

- [x] 4.1 对齐分页结构：仅左右图标按钮 + 页码指示器
- [x] 4.2 对齐可访问性：上一页/下一页按钮保留 `aria-label`
- [x] 4.3 对齐简化目标：不显示总量文案与每页条数选择器
- [x] 4.4 增加分页交互测试（首页禁用上一页、末页禁用下一页，`ProjectMemoryPanel.test.tsx`）

## 5. Hover 样式对齐

- [x] 5.1 对齐当前 hover 行为：背景/边框变化（无 `translateY`、无 hover 阴影增强）
- [x] 5.2 对齐 `importance-*` 的差异化 hover 渐变样式
- [x] 5.3 落地“纯高亮（无抬升阴影）”：已在 `project-memory.css` 完成实现并同步 spec/design/proposal

## 6. 验证与发布门禁

- [x] 6.1 `openspec validate t1-3-ui-memory-list-improvements --strict` 通过
- [x] 6.2 执行目标模块测试（新增组件测试后，`vitest run ProjectMemoryPanel.test.tsx` 已通过）
- [x] 6.3 执行最小回归（i18n、按钮、分页、hover）：组件测试通过 + 样式审计（hover 无 `translateY`/hover 阴影增强）
