## 1. Preview 数据与弹层交互

- [x] 1.1 扩展 rewind preview 文件项，保留 diff 与导出所需 session/engine/label 元信息
- [x] 1.2 重构 Claude rewind 确认弹层为紧凑文件 rail + 右侧 diff preview
- [x] 1.3 补齐完整 diff overlay 与文件级聚合逻辑，支持在确认流程内完成单文件核对

## 2. 变更导出能力

- [x] 2.1 新增 Tauri `export_rewind_files` 命令，按 `~/.ccgui/chat-diff/{engine}/{YYYY-MM-DD}/{sessionId}/{targetMessageId}/` 导出 `files/` 与 `manifest.json`
- [x] 2.2 在前端新增“存储变更”按钮、成功态与失败态反馈

## 3. 验证

- [x] 3.1 扩展前端测试，覆盖文件选中、diff 预览与导出按钮交互
- [x] 3.2 扩展 Rust 测试，覆盖目录结构、manifest、相对路径解析、file URI / 绝对路径与失败场景
- [x] 3.3 运行最小验证：目标测试 + TypeScript typecheck
