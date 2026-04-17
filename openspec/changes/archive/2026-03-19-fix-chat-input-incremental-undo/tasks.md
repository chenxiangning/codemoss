## 1. History Engine Foundation

- [x] 1.1 实现 `useUndoRedoHistory` 基础栈能力（输入：当前文本与选区范围；输出：undo/redo API；验证：新增 hook 单测覆盖 push/undo/redo/reset 与栈上限）。
- [x] 1.2 定义事务分组规则（输入：连续 input 事件与时间戳；输出：分组后的历史事务；验证：单测覆盖默认 `400ms` 窗口合并、空白/换行/粘贴/选择替换边界、重做链清除）。

## 2. ChatInputBox Integration

- [x] 2.1 在 ChatInputBox 键盘处理中接入 `Ctrl/Cmd+Z`、`Ctrl/Cmd+Shift+Z`、`Ctrl/Cmd+Y`（输入：键盘事件；输出：稳定 undo/redo 行为；验证：快捷键交互测试通过且不影响发送快捷键）。
- [x] 2.2 抽取统一程序化写入通道并替换补全/标签渲染路径（输入：程序化 mutation 请求；输出：统一历史事务提交；验证：补全插入与文件标签渲染后可单步撤销）。
- [x] 2.3 增加焦点边界守卫（输入：当前 activeElement 与 editable 状态；输出：仅在 ChatInputBox 聚焦时拦截 undo/redo；验证：非输入框焦点下快捷键行为不变）。
- [x] 2.4 增加程序化 no-op 判定（输入：mutation 前后 canonical text/selection；输出：逻辑文本不变时不入栈；验证：文件标签纯重排不会新增撤销步数）。

## 3. Platform Compatibility (mac/Windows/Linux)

- [x] 3.1 实现快捷键归一化映射（输入：keyboard event + runtime platform；输出：统一 undo/redo action；验证：单测覆盖 mac `Cmd+Z/Cmd+Shift+Z` 与 Windows `Ctrl+Z/Ctrl+Y/Ctrl+Shift+Z`）。
- [x] 3.2 扩展 Linux 兼容映射（输入：keyboard event + linux platform；输出：`Ctrl+Z` undo、`Ctrl+Shift+Z` redo；验证：归一化单测通过）。
- [x] 3.3 增加平台回归测试（输入：mac/Windows/Linux 快捷键序列；输出：行为一致的撤销/重做结果；验证：组件交互测试必过）。

## 4. IME and Cursor Safety

- [x] 4.1 增加 IME 历史提交保护（输入：composition start/end 与输入事件；输出：仅提交最终 composition 结果；验证：中文/日文/韩文 IME 场景无异常跳步撤销）。
- [x] 4.2 补齐光标恢复策略（输入：历史快照回放；输出：文本与光标一致恢复；验证：多次 undo/redo 后光标位置稳定且文本一致）。

## 5. Regression and Verification

- [x] 5.1 新增回归测试矩阵（输入：普通输入、补全、IME、程序化改写、selection replace 场景；输出：自动化测试用例；验证：组件交互测试必过 + 至少 1 条 e2e 冒烟通过）。
- [x] 5.2 执行手工验证清单并记录结果（输入：关键场景脚本；输出：验收记录；验证：无“单次撤销清空整段文本”回归，且选区回放一致）。
- [x] 5.3 增加回滚开关与演练（输入：feature flag/config 常量；输出：可一键退回原流程；验证：开关关闭后行为回到现状且不影响发送/补全）。
- [x] 5.4 增加非回归专项验证（输入：发送快捷键、补全菜单导航、文件标签渲染；输出：专项测试与手工记录；验证：功能行为与改造前一致）。
