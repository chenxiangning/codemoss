# Proposal: T1-3 UI Memory List Improvements (Code-Aligned Refresh)

## Why

原提案基于早期 Vue 路径描述，已与当前代码实现不一致。根据当前仓库代码（React +
TypeScript）核对后，需要把变更范围修正为“已实现行为”的准确表达，避免规范与代码漂移：

- 已实现 Kind/Importance 的 i18n 显示，但提案中的文件路径与技术栈描述过时
- 已实现底部统一操作区，但原提案仍包含与代码不一致的“反选”描述
- 已实现分页简化（图标翻页 + 页码指示），原提案未纳入
- 列表 hover 已调整为“纯高亮”（背景/边框变化），需在提案中按新现状定义

## What Changes

- 将提案技术基线更新为当前实现：
    - 前端组件：`src/features/project-memory/components/ProjectMemoryPanel.tsx`
    - 样式文件：`src/styles/project-memory.css`
    - 国际化文件：`src/i18n/locales/zh.ts`、`src/i18n/locales/en.ts`
- 将已落地行为纳入提案基线：
    - Kind/Importance i18n 渲染与降级显示
    - 底部统一操作区（批量操作 + 详情操作）
    - 分页简化（图标分页 + 页码）
    - hover 交互（背景/边框变化，无抬升、无阴影增强）
- 将按钮语义修正为当前交互：全选/取消全选、批量设优先级、批量删除、保存、删除

## Capabilities

### New Capabilities

- `memory-list-i18n`: Kind/Importance 字段国际化（已落地，作为基线）
- `memory-list-button-layout`: 底部统一操作区（已落地，作为基线）
- `memory-list-pagination-simplify`: 分页控件简化（已落地，作为基线）
- `memory-list-hover-style`: 列表 hover 的轻量视觉反馈（已落地，作为基线）

### Modified Capabilities

- `memory-list-button-layout`: 需求语义更新为“全选/取消全选 + 批量设优先级 + 批量删除 + 保存/删除”的当前交互模型，不包含“反选”按钮

## Impact

### 前端组件影响

- `src/features/project-memory/components/ProjectMemoryPanel.tsx`：按钮布局、分页交互、Kind/Importance 渲染
- `src/features/project-memory/hooks/useProjectMemory.ts`：分页状态与列表刷新行为

### 国际化文件

- `src/i18n/locales/zh.ts`：Kind/Importance、分页、批量操作文案
- `src/i18n/locales/en.ts`：Kind/Importance、分页、批量操作文案

### 样式文件

- `src/styles/project-memory.css`：列表 hover、操作区布局、分页与按钮视觉状态

### 用户体验

- 保持国际化与批量操作已有成果
- 降低 hover 视觉干扰，提升列表扫读稳定性
- 保持分页简洁可读，减少冗余信息噪音
