# Design: T1-3 UI Memory List Improvements (Code-Aligned)

## Context

当前实现已经从旧版方案演进到 React + TypeScript 结构，核心代码位于：

- `src/features/project-memory/components/ProjectMemoryPanel.tsx`
- `src/features/project-memory/hooks/useProjectMemory.ts`
- `src/styles/project-memory.css`
- `src/i18n/locales/zh.ts`
- `src/i18n/locales/en.ts`

原 design 文档仍使用 Vue/Element Plus 叙述，并包含与当前代码不一致的交互（例如“反选按钮”）。本次设计刷新目标是把规范基线收敛到现有代码行为。

## Goals / Non-Goals

**Goals**

- 用当前代码事实重建该 change 的设计描述
- 明确四个能力域的真实实现边界：i18n、hover、按钮布局、分页简化
- 为后续增量优化提供可追踪基线，避免规范漂移

**Non-Goals**

- 不改动当前项目记忆数据结构或后端 API
- 不引入新的筛选维度、排序策略或批量操作类型
- 不在本次文档修复中要求新增 UI 代码重构

## Decisions

### Decision 1: i18n 渲染策略

**选择**：组件内使用 `t("memory.kind.*")` 与 `t("memory.importance.*")` 显示标签；未知值降级显示原始字符串。

**代码证据**：

- `ProjectMemoryPanel.tsx` 中 `kindLabel` / `importanceLabel` 的 `switch + default`。
- `zh.ts` 与 `en.ts` 中 `memory.kind`、`memory.importance` 文案。

**结果**：

- 支持已定义类型和值的中英文显示
- 对未收录值保持可见，不阻塞页面渲染

### Decision 2: 操作区布局策略

**选择**：采用底部统一操作区，左侧为批量操作，右侧为详情操作。

**当前按钮组成**：

- 批量区：全选/取消全选、批量设高/中/低、批量删除
- 主操作区：保存、删除

**代码证据**：

- `ProjectMemoryPanel.tsx`：`project-memory-actions`、`project-memory-batch-actions`、`project-memory-main-actions`
- `project-memory.css`：对应布局样式与响应式换行

**备注**：当前实现不包含“反选”按钮，规范需同步该事实。

### Decision 3: 按钮图标策略

**选择**：关键操作使用图标增强识别，不强制所有按钮均带图标。

**现状**：

- 带图标：全选、取消全选、批量删除、保存、删除
- 无图标：批量设高/中/低

**理由**：

- 高风险/高频按钮优先视觉强化
- 保持界面密度与可读性平衡

### Decision 4: 分页简化策略

**选择**：仅保留图标翻页与页码指示，不显示额外元信息。

**现状**：

- 左右箭头按钮（带 aria-label）
- 页码指示器（`current / total`）
- 无“共 X 条记录”与“每页条数选择器”

**代码证据**：

- `ProjectMemoryPanel.tsx`：`project-memory-pagination`
- `project-memory.css`：分页区域居中与紧凑布局

### Decision 5: Hover 视觉反馈策略

**选择**：列表项 hover 使用纯高亮反馈（背景/边框变化），不使用抬升与阴影增强。

**现状样式**：

- 背景与边框颜色变化
- `importance-*` 项目有单独 hover 渐变

**代码证据**：

- `project-memory.css`：`.project-memory-list-item:hover` 与 `.importance-*:hover`

## Risks / Trade-offs

### Risk 1: 规范继续与实现脱节

- **风险**：后续 UI 变更快于文档更新
- **缓解**：以组件路径与样式类名作为 review 检查项

### Risk 2: Hover 视觉风格争议

- **风险**：部分设计偏好更强视觉层级（轻抬升/阴影）
- **缓解**：当前保持纯高亮基线，若需增强可作为后续独立变更

### Risk 3: 批量按钮图标一致性争议

- **风险**：是否“所有按钮都应有图标”存在不同偏好
- **缓解**：当前基线先描述事实，后续若要统一可单独提案

## Verification

最小验证路径：

1. 检查 i18n key 使用与 locale 定义是否一致
2. 检查底部操作区 DOM 与按钮分组是否匹配
3. 检查分页区域仅包含左右按钮与页码指示
4. 检查 hover 样式不包含 `translateY` 与 hover 阴影增强，仅保留背景/边框变化

## Open Questions

1. 是否需要在后续版本恢复“轻抬升/阴影增强”作为可选视觉层级？
2. 是否统一给批量设优先级按钮补充图标？
3. 是否为 `ProjectMemoryPanel` 增加组件级测试覆盖（i18n/按钮状态/分页）？
