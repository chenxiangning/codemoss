# fix-pi-at-reference-transport

## Why

Composer 的 `@` 文件/文件夹引用（`insertFilePathReferences`，`src/features/composer/components/ChatInputBox/utils/filePathReferences.ts`）以纯文本 `@/abs/path` token 插入输入框，发送时整条 text 原样进入 `SendMessageParams.text`。pi adapter（`src-tauri/src/engine/pi.rs` `build_command`）把整条 text 作为**单个 positional argv** 传给 `pi --print --mode json`，而 pi CLI 的 argv 解析（`dist/cli/args.js`）对任何 `arg.startsWith("@")` 的 token 一律当作 fileArg：

- 消息以 `@/path` 开头 → **整条消息**（含后续 `@`、空格、中文）被当成一个文件路径 → `file-processor.js` `access()` 失败 → `Error: File not found: <整条消息>` → `process.exit(1)` → Turn failed（2026-08-14 实机复现）。
- 消息中间的 `@/path` → pi print 模式不展开内联 `@`（该展开仅存在于 TUI 编辑器层），引用文件内容不会注入，模型只能看到路径字符串。
- pi 的 `@file` 只支持 regular file；文件夹引用 `readFile` 必失败。

对比：gemini adapter 已有 `escape_path_for_at_reference`（`gemini.rs`）处理同类问题；pi 目前只对 `params.images` 做了 `@file` argv 通道，prompt 文本内的 `@` 引用完全无处理。

## What Changes

- `pi.rs` 新增 `extract_at_file_references`：build_command 前扫描 prompt text 中的 `@path` token，用**文件系统最长前缀贪婪匹配**判定真实存在的 regular file（兼容带空格路径、绝对/相对路径，相对路径以 workspace 为基）。
- 命中文件 → 转为独立 `@<abs>` argv（复用 images 的 `@file` 通道，排在 prompt 之前），token 从 text 中移除；与 `params.images` 去重。
- 文件夹 / 不存在路径 / 非路径 `@` 文本（如 `@某人`）→ 原样保留为纯文本，不注入、不报错。
- 兜底 guard：提取后最终 prompt argv 若仍以 `@` 开头（未解析 token），前缀一个空格，防止 pi 把整条消息误判为 fileArg（对齐现有 `-` 开头 guard 的 pattern）。
- 前端零改动；其他 engine 零改动。

## Capabilities

### New Capabilities

- `pi-file-reference-transport`: prompt text 内 `@` 文件引用的提取、`@file` argv 投递、folder/未解析降级与 leading-`@` argv guard。

### Modified Capabilities

- 无（`engine-image-input-boundary` 的 Pi image transport 行为不变，仅复用其 argv 通道）。

## Impact

- 代码：`src-tauri/src/engine/pi.rs`（`build_command` + 新 helper + 单测）。
- 行为：pi 引擎下 `@文件` 引用从「必崩 / 静默不注入」变为「内容注入」；文件夹引用保持纯文本（pi 作为 agent 可用自有工具探索目录）。
- 兼容：不含 `@` token 的消息行为完全不变；未命中文件系统的 `@` 文本（mention 等）保持原义。

## 非目标

- 不改前端 Composer 的 `@` token 序列化格式（跨 engine 统一序列化是独立议题）。
- 不做文件夹递归展开为文件列表（爆炸风险：node_modules 等；pi 有工具可自行探索）。
- 不动 gemini / claude / codex 等其他 engine 的引用投递链路。

## 风险

- 贪婪最长前缀匹配依赖文件系统存在性判定：极端情况下用户正文中恰好存在以 `@` 开头且能匹配到真实文件的路径文本，会被提取为文件引用（内容注入 + 文本移除）。缓解：仅在 token 边界（行首/空白后）识别，且要求 `metadata.is_file()`。
- 大文件引用注入受 pi `file-processor` 自身处理（empty skip / read error exit）；mossx 侧不做 size 预检，与 images 通道现状一致。
