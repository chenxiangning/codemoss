# fix-pi-at-reference-transport design

## Context

pi CLI print 模式的参数契约（`@earendil-works/pi-coding-agent` dist 事实源）：

1. `cli/args.js`：argv token 级解析，`arg.startsWith("@")` → `fileArgs.push(arg.slice(1))`。mossx 把整条 prompt 作为**一个** argv 元素传入，因此只要 prompt 以 `@` 开头，整条消息（含空格与中文）就成为一个假文件路径。
2. `cli/file-processor.js`：对每个 fileArg `access()` 失败即 `console.error` + `process.exit(1)`；非图片走 `readFile()`（目录必失败）；内容包装为 `<file name="...">` 注入 prompt。
3. print 模式**不会**展开 message 文本内联的 `@path`（内联展开是 TUI editor 层行为）。

mossx 现状：`build_command`（`pi.rs`）仅对 `params.images` 走 `cli_image_input::pi_image_file_args` 生成 `@file` argv；prompt 文本只做 `-` 开头 guard（`safe_text`）。

## Decision

在 `pi.rs` 内新增 extraction helper，`build_command` 中于 images 处理之后、prompt 入 argv 之前执行：

```
extract_at_file_references(text, workspace_path) -> (cleaned_text, file_args)
```

**识别规则**：

- token 边界：`@` 必须位于 text 起始或空白字符之后。
- 从 `@` 后取候选子串，按后续每个空白边界逐档缩短，**最长优先**做文件系统判定（`normalize_local_image_path` 归一化 → 相对路径 join workspace → `metadata.is_file()`），首个命中即采纳。贪婪最长匹配保证 `/path/with space/shot one.png` 这类带空格路径可用。
- 命中：record `@<abs>` file arg，从 text 中移除该 token（保留其前后其余文本），继续扫描剩余部分。
- 未命中（文件夹、不存在路径、`@mention` 等）：原样保留，扫描指针越过该 `@` 继续。

**Argv 组装顺序**（与 images 通道一致，fileArgs 必须先于 prompt）：

```
pi --print --mode json [--model] [--session-id] [--thinking] @img1 @ref1 @ref2 <prompt>
```

`@ref` 与 `@img` 按绝对路径去重（同一路径同时在 images 与文本引用中只传一次）。

**Leading-`@` guard**：提取后若 `cleaned_text` 仍以 `@` 开头（未解析 token），沿用 `safe_text` 同款手法前缀一个空格，使 pi argv 解析不把它当 fileArg。该 guard 与现有 `-` guard 合并为同一处处理。

**降级语义**：

- 文件夹引用 → 保留纯文本路径。理由：pi `@file` 不支持目录（`readFile` EISDIR → exit 1）；递归展开有爆炸风险；pi 是 tool-using agent，拿到路径文本可自行 `ls`/`read`。
- 不存在路径 → 保留纯文本，不 fail turn（与「mention 类 `@` 文本」无法区分，且静默降级优于误杀整条消息）。
- 提取后 text 为空（消息仅含 `@file`）→ 允许空 prompt argv，pi 侧由 `<file>` wrapper 保证 turn 非空（与 image-only send 同形态）。

## Alternatives

- **前端统一序列化为 `<file>` 块**：跨 engine 更干净，但改动面覆盖所有 engine 的历史展示与投递链路，超出本次止血范围；列为后续独立 change。
- **仅 guard 不提取**（只防崩溃）：`@` 引用对 pi 永远只是纯文本路径，文件内容不注入，能力弱于其他 engine；不采纳。
- **文件夹展开为有界文件列表**（如 ≤N 个、ignore-aware）：价值真实但引入遍历策略与 ignore 语义复杂度；留作 follow-up。

## Risks / Mitigation

- 误判正文中的 `@路径` 文本 → token 边界 + `is_file()` 双重门槛；单测覆盖 mention / 文件夹 / 不存在路径三 false-positive 场景。
- pi 版本演进导致 argv 契约变化 → 本 change 只消费已 stabilize 的 `@file` argv 契约（images 通道已在用），无新增依赖面。

## 验收口径

- `cargo test` pi 模块全绿（含新增 extraction 单测 ≥6 场景）。
- `cargo check --lib` 通过。
- `openspec validate --all --strict --no-interactive` 通过。
- 复现用例（消息以 `@/abs/file @/abs/dir 中文指令` 开头）组装出的 argv：文件进 `@file` argv、目录保留文本、prompt 不以 `@` 开头。
