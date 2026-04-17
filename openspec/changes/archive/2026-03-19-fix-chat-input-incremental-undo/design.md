## Context

当前 ChatInputBox 基于 `contenteditable` 实现，输入过程中会混合两类变更来源：
- 用户原生键盘输入（浏览器/JCEF 原生编辑栈可感知）
- 程序化文本改写（如 `innerText/innerHTML`、补全插入、文件标签渲染）

这两类路径混用导致原生 undo 栈语义不稳定，表现为 `Ctrl/Cmd + Z` 大步回退甚至清空整段内容。问题已影响日常输入体验，且在 IME、补全、标签渲染组合场景下更明显。

约束：
- 不更换输入组件架构（仍使用 ChatInputBox + contenteditable）
- 不改后端协议
- 不破坏现有发送快捷键、补全菜单、文件标签流程
- 仅在输入框聚焦时处理 undo/redo，不污染全局快捷键域
- Win/mac 需要各自遵循平台主流按键习惯

## Goals / Non-Goals

**Goals:**
- 在 ChatInputBox 内提供稳定、可预测的小步 undo/redo 行为。
- 统一用户输入与程序化更新的历史语义，消除“首步即清空”。
- 提供可测试的历史事务边界与快捷键处理规则。

**Non-Goals:**
- 不引入跨会话持久化 undo 历史。
- 不重构所有 contenteditable 相关模块。
- 不变更 Enter/Cmd+Enter 发送语义。

## Decisions

### Decision 1: 引入应用层历史管理 `useUndoRedoHistory`

- 选择：新增独立 hook 维护 `undoStack / redoStack / present`，并提供 `pushSnapshot / undo / redo / reset`。
- 原因：原生栈在程序化 DOM 改写下不可控，应用层历史可精确定义事务边界并可测试。
- 备选方案：
  - 保留原生 undo（不采用）：改动小，但无法避免程序化改写污染历史。
  - 完全替换为 textarea（不采用）：代价高，超出本次边界。

### Decision 2: 使用“输入分组事务”策略，而非逐字符快照

- 选择：连续输入在短时间窗口内合并为一个事务（默认 `400ms`），空白/换行/粘贴/选择替换/补全提交作为边界。
- 原因：更贴近主流编辑器体感，避免栈爆炸。
- 备选方案：
  - 逐字符快照（不采用）：撤销过碎且性能开销高。
  - 每次 input 都成事务（不采用）：撤销频率过高、体验割裂。

### Decision 3: 程序化更新走统一写入通道

- 选择：新增统一入口（如 `applyEditorTextMutation`），在执行程序化写入前后与历史管理联动。
- 原因：补全、文件标签渲染、prompt 注入等路径必须共享同一历史规则。
- 规则补充：
  - 只有“逻辑文本或选区变化”才提交事务。
  - 对于纯 DOM 重排（如 file-tag 仅重绘，不改变 logical text），不创建新事务。
- 备选方案：
  - 各处自行操作 `innerText/innerHTML`（不采用）：容易漏点，历史语义不一致。

### Decision 4: 显式处理撤销/重做快捷键

- 选择：在键盘处理链路中捕获 `Ctrl/Cmd + Z`、`Ctrl/Cmd + Shift + Z`、`Ctrl/Cmd + Y`，优先执行应用层 undo/redo。
- 原因：保证跨平台一致性并避免被其他逻辑吞没。
- 备选方案：
  - 依赖默认浏览器行为（不采用）：在当前架构下不稳定。

### Decision 5: 引入平台快捷键归一化层

- 选择：新增平台判定与快捷键归一化函数（如 `resolveUndoRedoShortcut(event, platform)`）。
- 行为约定：
  - mac: `Meta+Z` => undo，`Meta+Shift+Z` => redo
  - Windows: `Ctrl+Z` => undo，`Ctrl+Y`/`Ctrl+Shift+Z` => redo
  - Linux: `Ctrl+Z` => undo，`Ctrl+Shift+Z` => redo（按 Windows 语义兼容）
  - 未命中映射时不拦截事件
- 原因：平台体验一致性必须显式建模，避免分散在多个 handler 中造成回归。
- 备选方案：
  - 在现有 handler 里硬编码条件（不采用）：可维护性差，后续扩展风险高。

### Decision 6: 历史快照模型采用 Canonical Text + Selection Range

- 选择：历史快照以 `{ text, selectionStart, selectionEnd }` 为基础模型；collapsed selection 用相同 start/end 表示。
- 原因：替换输入、补全替换、粘贴覆盖等场景需要完整选区语义，单点光标不足以保证回放一致性。
- 备选方案：
  - 仅保存单点 cursor offset（不采用）：覆盖类编辑后回放不稳定，易出现“文本对但光标错”。

## Risks / Trade-offs

- [Risk] IME 组合输入期间误入栈导致异常回退  
  → Mitigation: 组合输入阶段禁止快照提交，仅在 composition end 后按事务提交。

- [Risk] 文件标签 `innerHTML` 重写与虚拟光标恢复冲突  
  → Mitigation: 历史快照包含纯文本与选区范围，且对“逻辑文本不变”的 DOM 重排禁止入栈。

- [Risk] 撤销逻辑与发送/补全快捷键冲突  
  → Mitigation: 在键盘处理优先级中固定 `undo/redo > completion navigation > submit` 并补单测。

- [Risk] 历史栈增长带来内存压力  
  → Mitigation: 设置栈上限（如 100 条事务），超限丢弃最旧快照。

- [Risk] Win/mac 快捷键分支不一致导致平台回归  
  → Mitigation: 增加平台矩阵测试（mac/Windows/Linux）和统一快捷键归一化单测。

- [Risk] 误拦截非输入框焦点下的系统快捷键  
  → Mitigation: 增加焦点守卫，仅在 `document.activeElement === editableRef.current` 时处理 undo/redo。

## Migration Plan

1. 在 ChatInputBox 引入 `useUndoRedoHistory`，默认启用，保持原有外部 API 不变。  
2. 将补全插入、标签渲染、prompt 注入等程序化写入改为统一事务入口。  
3. 接入快捷键处理并覆盖 undo/redo 组合键。  
4. 补测试后灰度验证（手工回归 + 自动测试）。  

回滚策略：
- 保留开关（feature flag 或配置常量）可快速退回原有输入流程。
- 回滚只影响前端输入行为，无后端迁移动作。

## Open Questions

- 是否在设置页暴露“撤销粒度偏好”开关（当前暂不纳入本次范围）。

## Regression Plan

- 必测链路：
  - 输入事务：连续输入、空白边界、换行、selection replace、粘贴。
  - 程序化改写：补全插入、prompt 注入、文件标签纯重排（no-op）。
  - 快捷键兼容：mac / Windows / Linux 三平台映射。
  - 边界守卫：非焦点、disabled、不可编辑态。
- 非回归链路：
  - 发送快捷键（Enter/Cmd+Enter）行为保持不变。
  - 补全导航与确认行为保持不变。
  - 文件标签渲染视觉与交互保持不变。
