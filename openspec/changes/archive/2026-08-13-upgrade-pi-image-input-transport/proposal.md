# upgrade-pi-image-input-transport

## Why

mossx(ccgui)对 **pi engine 的图片输入当前是「直接不让发」**:composer 粘贴/拖拽附件 UX 已存在,但 capability gate(`engineSupportsImageInput` → `isEngineCapabilityAvailable`)只认 `"supported"`,而 matrix 中 pi 的 `image.input` 是 **`"compat-input"`**,前端在 attach 与 send 两处拦截(`Composer.tsx:1092/2481`、`useThreadMessaging.ts:993/1402`)。

即使绕过 gate,现有 pi transport 也是**降级方案**:`build_pi_prompt_with_images` 把图片路径以文本指令注入 prompt(「You MUST call the read tool...」),图片能否进上下文依赖模型自觉调 `read`——非确定性,弱模型直接丢图。

事实:pi CLI print 模式原生支持 `@file` 附件参数(`pi --print @/abs/img.png "text"`),`processFileArguments` 把图片处理成 image content blocks **确定性随消息发送**(规范化 + ≤2000×2000 resize + base64),与 grok `--prompt-file` 的 ACP image block 同等级别。pi 模型 catalog 中大量模型已声明 `input:["text","image"]`(kimi-coding/k3、anthropic、openai 等)。**这是客户端能力统一:pi 与其他六个 engine 一样获得真正的图片发送链路**,不改 pi 源码。

## 目标与边界

- pi engine `image.input` 从 `"compat-input"` 升级为 `"supported"`,composer 图片附件 UX 对 pi 解锁(前端零代码变更,gate 自动放行)。
- pi.rs transport 从「prompt 文本注入」切换为 `@file` argv 附件,与 grok/opencode/kimi 同级的确定性发送。
- 历史边界:pi session jsonl 中新格式 user message(含 `<file name="...">` 文本与 image blocks)正确解析出可见文本 + 图片路径;**旧注入 marker 的历史消息继续可解析**(保留 `split_pi_prompt_for_display`)。
- 空文本附图发送可工作(pi 的 `<file>` wrapper 保证 prompt 非空,不引入 grok 式 fallback 文案)。
- 遵循 mossx OpenSpec 流程与 matrix 治理:cell 变更必须随 spec delta + `npm run check:engine-capability-matrix` 再生成。

## 非目标

- 不改 pi CLI 源码(此前的 fork 方向已废弃)。
- 不改 composer 附件交互(粘贴/拖拽/预览已存在)。
- 不动其他六个 engine 的 transport 与 matrix cell。
- 不覆盖 pi RPC 模式(pi RPC 明确拒绝 `@file`;mossx 用 `--print` 不受影响)。
- 不新增 pi 版本下限闸:`@file` 图片支持在 pi ≥0.84(及更早)已存在;若未来 mossx 引入 engine min-version 机制再接入。
- 不改 `images.blockImages` 或 pi-ai 非 vision downgrade 行为。

## What Changes

- `src-tauri/src/engine/pi.rs`:`build_command` 中图片改为 `@<abs path>` argv(置于 prompt 之前),不再调用 `build_pi_prompt_with_images`;`resolve_existing_image_files` 保留(data URL materialize、存在性校验复用)。
- `src-tauri/src/engine/cli_image_input.rs`:`build_pi_prompt_with_images` 退役发送路径(仅保留 `split_pi_prompt_for_display` 供历史解析);新增 `@file` argv 组装 helper。
- `src-tauri/src/engine/pi_history.rs`:user message 解析支持新格式——从文本提取 `<file name="...">` 为图片路径、剥离标签得可见文本、忽略 image blocks 的 base64(历史展示走路径,与 grok 同)。
- matrix:`openspec/specs/engine-capability-matrix/fixtures/matrix.json` pi `image.input` → `"supported"`,`scripts/check-engine-capability-matrix.mjs --write` 再生成 TS/RS/generated。
- OpenSpec delta:`engine-image-input-boundary` 新增 Pi transport / history requirement。
- 测试:Rust 单测(argv 组装、history 解析新旧两格式、空文本附图);matrix CI 校验;前端 gate vitest(pi 由 block 转 allow)。

## 方案取舍

- **方案 A(采用):`@file` argv。** pi 原生附件通道,确定性发送,零 fork 成本;history 需解析 `<file name>` 新格式(工作量小)。
- **方案 B(否决):维持 prompt 注入,matrix 仅改文案。** 发送仍依赖模型自觉 read,不满足「确定性」核心诉求。
- **方案 C(已废弃):fork pi 源码实现 TUI chip。** 目标理解错误(改的是 pi 交互模式而非 mossx 客户端),且 mossx 走 headless 与 TUI 无关。

## Capabilities

### New Capabilities

- 无新 capability。

### Modified Capabilities

- `engine-image-input-boundary`:purpose 的 engine 名单扩展至 Pi;新增 Pi `@file` transport 与 history presentation requirement。
- `engine-capability-matrix`(fixture 层面):pi `image.input` cell `"compat-input"` → `"supported"`;遵循该 spec 的 single-source / CI 一致性契约。

## Impact

- Backend:`src-tauri/src/engine/pi.rs`、`cli_image_input.rs`、`pi_history.rs`(+ 单测)。
- Frontend:无代码变更;验证 composer gate 解锁(`engineSupportsImageInput("pi")` → true)。
- Contracts / fixtures:`matrix.json` + 三端 generated 再生成。
- OpenSpec:`engine-image-input-boundary` delta。
- ADR 校准回写 Gate:命中「Shared 支持集合 / engine 能力事实」边界——收口前检查 `docs/research/mossx-multi-cli-provider-session-foundation-design.md` 校准表是否含 pi image transport 条目,若有须回写校准行(附本 change id)。
- Git 纪律:pi fork 仓的废弃改动在 `feat/interactive-image-attachments` 工作区,**与本 change 无关**;mossx 改动按用户指示 commit。

## 验收标准

1. pi engine 会话中 composer 粘贴截图 → 附件 chip 出现(不再弹「不支持图片」),发送后模型直接回答图片内容(不依赖 read 工具调用)。
2. 发送 argv 含 `@<abs path>` 且 prompt 不含 `mossx:pi-image-attachments` marker;pi jsonl 中 user message 含 image content block。
3. 历史 reload:新格式消息解析为「可见文本 + 图片路径」;旧注入 marker 消息解析不回归。
4. 空文本附图发送成功;不可读图片路径报错文案明确(复用 resolve_existing_image_files 错误)。
5. `npm run check:engine-capability-matrix` 绿;Rust 单测与前端 gate vitest 绿;三端 matrix 一致。
