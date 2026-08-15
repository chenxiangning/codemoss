# Design

`QuickJsWorkerDriver` 实现 `EntryDriver`：

- `start` 创建 isolate，只注入 Mossx handshake 桥
- `eval` 先过 deny-list，命中即 `permission-denied`
- `stop` 从 map 删除 isolate

本刀不解释完整 JS。引擎嵌入留 1QJ2。
