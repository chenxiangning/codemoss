## 1. Contract Lock (P0)

- [x] 1.1 固化回退契约：`rewind success == truncation committed`（输出：共享契约说明，前后端均引用）
- [x] 1.2 固化边界语义：锚点后数据必须从内存与磁盘同时不可见（输出：边界定义与错误码）

## 2. Backend Hard Truncation (P0)

- [x] 2.1 在 Codex rewind 链路实现硬截断提交（内存态 + 持久化态）
- [x] 2.2 将成功返回改为“截断提交完成后才返回”
- [x] 2.3 截断失败返回可恢复错误，禁止回退为 UI-only 成功

## 3. Frontend Alignment (P0)

- [x] 3.1 rewind 成功后线程状态强制刷新为截断后事实
- [x] 3.2 将 hidden-map 降级为过渡显示手段，不参与正确性判定

## 4. Lifecycle Consistency (P0)

- [x] 4.1 reopen / resume 链路验证：仅恢复锚点及其之前内容
- [x] 4.2 history fallback 链路验证：不得重新并回锚点后尾部事实
- [x] 4.3 send 基线切换：回退后后续续写绑定新 child thread 上下文

## 5. Verification Gate (P0)

- [x] 5.1 回归测试：rewind -> reopen / resume
- [x] 5.2 回归测试：rewind -> app restart 语义下的 persisted reopen
- [x] 5.3 回归测试：rewind -> send
- [x] 5.4 质量门禁：前端测试 + 类型检查 + 目标 Rust 测试通过
