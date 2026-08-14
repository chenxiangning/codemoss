# fix-pi-at-reference-transport tasks

## 1. OpenSpec artifacts

- [x] 1.1 proposal / design / tasks
- [x] 1.2 spec delta `pi-file-reference-transport`
- [x] 1.3 changes/README.md 索引登记

## 2. Rust 实现（`src-tauri/src/engine/pi.rs`）

- [x] 2.1 `extract_at_file_references`：token 边界识别 + 贪婪最长前缀 fs 匹配 + 文本移除
- [x] 2.2 `build_command` 接线：images 之后执行提取，`@ref` argv 先于 prompt，与 images 去重
- [x] 2.3 leading-`@` guard 合并进 `safe_text` 处理

## 3. 单测

- [x] 3.1 消息以 `@file` 开头：文件进 argv 且在 prompt 前，prompt 不含该 token、不以 `@` 开头
- [x] 3.2 带空格路径（贪婪最长匹配）
- [x] 3.3 相对路径以 workspace 为基解析
- [x] 3.4 文件夹引用保留纯文本 + prompt 不以 `@` 开头
- [x] 3.5 不存在路径 / `@mention` 保留纯文本
- [x] 3.6 与 images 同路径去重
- [x] 3.7 无 `@` 消息零回归（现有 `build_command_without_images_has_no_at_file_args` 保持绿）

## 4. Verify

- [x] 4.1 `cargo test` pi 模块（27 passed，含新增 6 场景）
- [x] 4.2 `cargo check --lib`
- [x] 4.3 `openspec validate --all --strict --no-interactive`
- [x] 4.4 复现用例 argv 人工核对（用户 2026-08-14 验收通过）
