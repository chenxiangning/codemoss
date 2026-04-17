## Why

当前项目已经具备文件树、多 Tab 打开、CodeMirror 编辑与语法渲染能力，但“代码智能导航”仍缺失：

- 在 `.java` / `.ts` / `.py` 等代码文件中，无法 `Ctrl/Cmd + Click` 跳转定义。
- 无法从方法/类符号直接查看引用（Find Usages / Find References）。
- 打开文件后只具备文本编辑能力，不具备 IDE 级“符号联动”。

你希望把 IntelliJ 风格的核心体验（跳转定义、查看引用、类名/方法名联动）带到当前项目。该提案用于在现有文件系统能力基础上，补齐“代码导航最小闭环”。

## 目标与边界

- 目标：在文件视图中提供 `Ctrl/Cmd + Click` 跳转定义能力。
- 目标：在文件视图中提供“查找引用”能力，展示引用结果列表并可点击跳转。
- 目标：支持跨文件导航（当前工作区内）。
- 目标：优先覆盖 Java 使用场景，并保持语言无关架构可扩展。
- 目标：保证打开文件与多 Tab 行为不回退。
- 边界：本提案聚焦“导航与引用”；不实现完整重构（rename/extract/change signature）。
- 边界：不引入完整 IDE/LSP 客户端重写，优先复用现有 OpenCode LSP 调用链。

## 非目标

- 不在本次实现语义重构能力（rename symbol、safe delete）。
- 不实现调试器级导航（stack frame/source map 级别跳转）。
- 不覆盖所有语言高级语义（如宏展开、模板实例化深层语义）。

## What Changes

- 新增“文件视图代码智能导航”能力域（新 capability）。
- 在前端文件编辑器中新增符号交互层：
    - `Ctrl/Cmd + Click` 跳转定义。
    - 快捷键/菜单触发“查找引用”。
    - 多目标时展示候选列表并支持二次选择。
- 新增“按位置定位打开文件”能力（打开文件并定位到行列）。
- 复用并扩展现有 Tauri OpenCode LSP 调用：
    - 保留已存在 diagnostics/symbols/document-symbols。
    - 增加 definition/references 查询命令（或等价后端能力）。
- 新增结果面板（references list）与状态反馈（loading/empty/error）。
- 增加回归测试：导航成功、无结果回退、错误兜底、多目标选择、跨文件打开定位。

## 技术方案对比

### 方案 A：纯文本检索驱动导航（正则/grep）

- 优点：实现快，无需后端扩展。
- 缺点：语义不准确，重名符号误报严重，无法替代 IDE 体验。
- 结论：不采纳。

### 方案 B：基于 LSP 语义导航（推荐）

- 优点：语义准确，可扩展到多语言，和 IntelliJ 核心体验一致。
- 缺点：需补齐后端 LSP 查询命令与前端定位链路。
- 结论：采纳。

## Capabilities

### New Capabilities

- `file-view-code-intelligence-navigation`：定义文件视图中的符号跳转、引用查询、跨文件定位与失败回退行为。

### Modified Capabilities

- `filetree-multitab-open`（预期影响）：新增“按位置激活/打开文件”语义后，需保证不破坏现有多 Tab 行为。

## 验收标准

1. 在支持语言代码文件中，`Ctrl/Cmd + Click` 符号 MUST 可触发“跳转定义”流程。
2. 若定义唯一，系统 MUST 直接打开目标文件并定位到目标行列。
3. 若定义多处，系统 MUST 展示候选列表并允许用户选择后跳转。
4. “查找引用” MUST 返回引用列表，并支持点击引用项跳转。
5. 跨文件跳转 MUST 复用现有多 Tab 机制，不得关闭已有已打开文件。
6. 跳转到同一已打开文件时 MUST 激活该 Tab 并更新光标/滚动位置。
7. 当后端不支持或无结果时，系统 MUST 提供可理解提示，不得崩溃。
8. 当 LSP 查询报错时，系统 MUST 显式提示失败并允许用户重试。
9. 现有文件打开、切换、关闭、保存能力 MUST 与变更前保持一致。
10. 至少 Java 场景下（类名、方法调用）MUST 通过端到端验收。

## Impact

- Affected code（预期）：
    - `src/features/files/components/FileViewPanel.tsx`
    - `src/features/app/hooks/useGitPanelController.ts`
    - `src/features/layout/hooks/useLayoutNodes.tsx`
    - `src/services/tauri.ts`
    - `src-tauri/src/engine/commands.rs`
    - `src-tauri/src/lib.rs`
- API / Protocol：新增 Tauri command（definition/references）与前端调用包装。
- Dependencies：优先复用现有依赖；如需 UI 列表/浮层能力，沿用现有组件体系。
- Systems：影响文件编辑区交互、LSP 查询调用链、Tab 打开定位逻辑。
