## 1. File changes 点击入口接入（P0）

- [x] 1.1 (P0, depends: none, <=2h) 在 `ToolBlockRenderer -> GenericToolBlock` 透传 `onOpenDiffPath`；输入=现有消息工具卡片 props，输出=`File changes` 文件项可触发统一 diff 打开入口；验证=点击文件项可进入现有 diff 流程且无 TS 类型错误。
- [x] 1.2 (P0, depends: 1.1, <=2h) 将 `File changes` 文件项改为显式可点击元素并隔离事件冒泡；输入=文件行渲染结构，输出=点击行为不影响卡片折叠与统计展示；验证=交互测试通过（点击文件触发、点击头部折叠仍正常）。

## 2. 工具卡片持久化契约收敛（P0）

- [x] 2.1 (P0, depends: none, <=2h) 梳理并补齐 `commandExecution/fileChange` 从 realtime adapter 到 history loader 的字段保真映射；输入=现有 adapter + thread item 归一化逻辑，输出=关键字段在重启后可恢复；验证=新增/更新单元测试覆盖路径与输出字段。
- [x] 2.2 (P0, depends: 2.1, <=2h) 建立重启回放验证用例（或等效集成测试）覆盖“实时出现 -> 持久化 -> 重启回放”；输入=线程持久化快照样本，输出=历史详情页仍展示工具卡片；验证=测试断言 `commandExecution/fileChange` 重放可见。

## 3. 非回归门禁：复用组件行为不变（P0）

- [x] 3.1 (P0, depends: 1.2, <=2h) 增加回归断言，确保 conversation 入口不会修改 Git diff 组件默认行为（视图模式、工具栏语义、既有偏好）；输入=现有 diff 组件交互基线，输出=非回归测试；验证=基线测试与新增测试同时通过。
- [x] 3.2 (P0, depends: 1.2, <=2h) 增加异常链路保护：路径不可解析时提供可恢复提示并保持会话可操作；输入=不可解析路径样本，输出=失败可恢复且无崩溃；验证=错误场景测试通过。

## 4. 跨引擎一致性回归（P1）

- [x] 4.1 (P1, depends: 2.2, <=2h) 为 Claude/Codex/OpenCode 增补 parity 断言，验证工具卡片实时与历史语义一致；输入=三引擎统一样本事件，输出=跨引擎一致性报告；验证=parity test 全绿。
- [x] 4.2 (P1, depends: 3.1, 4.1, <=2h) 执行最小验收清单并记录结果；输入=验收标准与测试命令，输出=可追溯验收记录；验证=手测（点击 + 重启）与自动化结果一致。
