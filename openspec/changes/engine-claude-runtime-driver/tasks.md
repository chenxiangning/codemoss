# Tasks

- [x] 1.1 落盘 proposal + spec delta，明确「真实可执行文件解析通路」与「不接 boot/产品」边界
- [x] 1.2 `openspec validate engine-claude-runtime-driver --strict --no-interactive`
- [x] 1.3 实现 `restricted_process_driver_for`：从可审计 bin_path 构造带 handshake 的真实 driver，无路径 fallback missing_executable
- [x] 1.4 测试：真实路径→handshake、None/空→missing_executable 安全闸门（2 个）
- [x] 1.5 `cargo test --lib plugin_runtime::spawn`（20 passed）
- [x] 1.6 端到端测试：helper 解析的真实 driver spawn 真实 peer → activate Ready → disable 杀进程（live_count 归零）
- [x] 1.7 `cargo test --lib plugin_runtime::spawn`（21 passed）
