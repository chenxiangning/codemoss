# upgrade-pi-image-input-transport — Design

## Context

mossx 通过 `pi --print --mode json [--model] [--session-id] [--thinking] <prompt>` 驱动 pi headless(`src-tauri/src/engine/pi.rs build_command`)。图片现状:

- **前端 gate 拦截**:matrix(`openspec/specs/engine-capability-matrix/fixtures/matrix.json`)中 pi `image.input = "compat-input"`;`isEngineCapabilityAvailable` 只认 `"supported"` → composer attach 弹「不支持图片」、send 路径剥图(`Composer.tsx:1092/2481`、`useThreadMessaging.ts:993/1402`)。后端 `require_image_support` 不拦(`EngineFeatures::pi().image_input = true`)。
- **transport 是文本注入降级**:`build_pi_prompt_with_images` 在 prompt 尾部注入 `<!-- mossx:pi-image-attachments -->` marker + 路径清单 + 「MUST call the read tool」指令;`split_pi_prompt_for_display` 供历史解析剥离。图片进上下文依赖模型自觉 read,非确定性。
- **pi 原生能力(已证实,pi 仓 origin/main)**:print 模式 positional arg 以 `@` 开头即进 `fileArgs`(`cli/args.ts:212`),`processFileArguments` 对图片做 mime 规范化 + ≤2000×2000 resize + base64,产出 `{type:"image"}` content blocks 随首条消息确定性发送;pi jsonl 落盘为 `content = [{type:"text", text:"<file name=\"/abs/p.png\"></file>\n..."}, {type:"image", ...}]`(fileText 在 user text 之前,`cli/initial-message.ts:30-36`)。RPC 模式拒绝 `@file`(mossx 不用 RPC,无影响)。
- 对齐基准:grok transport(`--prompt-file` ACP image block)已满足「argv 只带路径、图片确定性进消息、history 路径展示」三要素(`engine-image-input-boundary` spec)。

## Goals / Non-Goals

**Goals:**

1. pi 图片发送从「注入 + 模型自觉 read」升级为「`@file` argv + pi 原生附件」,确定性直达 vision 模型。
2. matrix pi `image.input = "supported"`,composer 现有附件 UX 对 pi 解锁(前端零代码)。
3. 历史 reload 新格式解析出「可见文本 + 图片路径」;旧注入 marker 历史不回归。
4. 失败语义与其他 engine 一致:图片全部不可解析 → 发送前明确报错(复用 `resolve_existing_image_files` 的 Err)。

**Non-Goals:**

- 不改 pi 源码、不引入 pi 版本闸、不动 composer UX、不动其他 engine。
- 不处理「模型不支持 vision」的额外提示(pi-ai 层既有 downgrade placeholder,行为与其他 engine 一致)。
- 不改 mossx 运行时发送态记录(frontend 已把 images 存进 user message,grok 等在用)。

## Decisions

### D1 — transport:`@file` argv 替代 prompt 注入

- **选择**:图片非空时,`build_command` 在 prompt arg 之前逐个插入 `@<absolute path>`(路径已由 `resolve_existing_image_files` 保证存在且为文件)。prompt 文本保持用户原文,不再拼接注入 marker。
- **替代**:保留注入、仅放开 matrix(B 方案);或 data URL materialize 后注入。
- **理由**:pi 的 `@file` 是确定性附件通道,与 grok `--prompt-file` 同级;argv 只带路径不带 base64,无 ARG_MAX 风险(与 grok D 决策一致)。
- **顺序与转义**:`@` 前缀拼接无需 shell 转义(Command argv 直传);含空格/非 ASCII 路径安全。`@` 开头的真实文件路径不会被误当 flag(pi parser 优先匹配 `@`)。
- **safe_text 逻辑保留**:prompt 前导空格防 `-` 解析的既有处理不变。

### D2 — 空文本附图:依赖 pi `<file>` wrapper,不引入 fallback 文案

- **选择**:用户文本为空时 prompt arg 传空串;pi 侧 `buildInitialMessage` 以 `<file name="..."></file>` 作为 prompt 文本,保证非空。
- **替代**:照搬 grok 的 `GROK_IMAGE_ONLY_FALLBACK_TEXT`。
- **理由**:grok 需要 fallback 是因为 ACP 协议要求至少一个 text block;pi 无此约束。引入 CLI-only 文案又要多一条 history 剥离规则,无收益。

### D3 — history:新格式解析 + 旧 marker 保留

- **选择**:`pi_history.rs` user 分支先走 `split_pi_prompt_for_display`(旧注入 marker),未命中再走新增的 `split_pi_file_attachments_for_display`:
  - 从文本提取全部 `<file name="X">...</file>`(X 经 XML attr unescape,复用现有 `unescape_xml_attr`)→ images 路径(dedupe);
  - 可见文本 = 剥离这些标签(含 inner hints)后的剩余文本 trim;
  - `content` 中的 `{type:"image"}` blocks 直接忽略(展示走路径,与 grok 一致;base64 不进历史投影,避免 MB 级数据进 UI 状态)。
- **理由**:旧 session(注入时代)与新 session(`@file` 时代)混合存在,两种格式必须共存解析;`<file name>` 是普通用户手输概率极低的结构化标签,与既有 marker 同级的误判风险可接受(spec scenario 固化「普通文本不剥离」)。

### D4 — matrix 变更走治理流程

- **选择**:改 `fixtures/matrix.json` pi `image.input` → `"supported"` → `scripts/check-engine-capability-matrix.mjs --write` 再生成 `engineCapabilityMatrix.generated.ts` 与 `capability_matrix.generated.rs` → `npm run check:engine-capability-matrix` 验证三端一致。
- **理由**:spec 明确「cell 变更必须随 OpenSpec change + spec delta」,禁止手改 generated。
- **连带**:`engineSupportsImageInput("pi")` 转 true 后,`engineImageInput.ts` 注释「All current engines support...」与事实重新一致;`compat-input` 语义(input.mid-turn)不受影响。

### D5 — 发送失败的错误语义不变

- **选择**:`resolve_existing_image_files` 全部失败 → 发送前 Err(不降级为纯文本发送);部分失败 → warn 日志继续(现状)。
- **理由**:与 grok「image load failure is explicit」scenario 对齐;静默丢图是本 change 要消灭的行为。

### D6 — 退役但不删除注入 helper

- **选择**:`build_pi_prompt_with_images` 发送路径停用(调用点移除),函数与 `split_pi_prompt_for_display` 保留(历史解析依赖);标注 `#[allow(dead_code)]` 或改为 `#[cfg(test)]`+history 专用,以编译器告警为准选最小形式。
- **理由**:历史解析(D3)与旧回归测试仍引用;直接删除会连带删测试,扩大 diff。

## 数据流

```
composer 粘贴/拖拽 → images: string[](路径 / data URL)
  → EngineSendMessageParams.images
  → resolve_existing_image_files(data URL materialize 到 workspace staging)
  → pi.rs argv: pi --print --mode json ... @/abs/1.png @/abs/2.png " user text"
  → pi processFileArguments → image content blocks(规范化+resize)
  → pi jsonl user message: [text(<file name> + user text), image blocks]
  → mossx 运行时 user bubble:text + images(路径,既有逻辑)
  → 历史 reload:pi_history split → display_text + images(路径)
```

## 风险与缓解

| 风险 | 缓解 |
| ---- | ---- |
| pi 旧版本不支持 `@file` 图片(版本下限未知) | `@file` 图片在 pi 0.84.1 已证实;`processFileArguments` 对不存在文件 `exit(1)`——mossx 已预检存在性;若用户 pi 过旧,失败显性化(进程报错)而非静默 |
| `<file name>` 与 user 手输文本碰撞 | 概率极低;spec scenario 固化「不含 `<file name=` 的文本原样保留」 |
| 多图顺序 | argv 顺序 = images 顺序;pi file-processor 顺序处理,history 按标签出现顺序提取,两端一致 |
| pi jsonl 中 image blocks 的 base64 导致历史文件膨胀 | 既有 pi 行为(@file 一直如此);mossx 历史解析忽略 image blocks,不二次放大 |
| matrix regen 产生无关 diff | generator 是确定性的;若有无关 cell diff 说明上游 fixture 已漂移,单独处理不混入 |

## 测试策略

- Rust 单测(`pi.rs` / `cli_image_input.rs` / `pi_history.rs`):
  - argv 组装:多图顺序、空文本、含空格/非 ASCII 路径、data URL materialize;
  - history:新格式(单图/多图/纯图无文本/带 hints inner)、旧注入 marker 回归、普通文本不剥离;
  - 全失败报错、部分失败 warn。
- matrix:`npm run check:engine-capability-matrix` 三端一致;`capability_matrix.rs` 内嵌测试更新(pi image.input supported)。
- 前端:`engineImageInput` vitest 补 pi→true 用例;composer gate 现有测试若 mock 了 pi=compat 需同步。
- 实机验收矩阵:pi × vision 模型(k3)粘贴截图发送;空文本附图;历史 reload;旧 session 混排。

## 实施顺序

1. matrix fixture + regen + CI 校验(解锁前端 gate,可独立验证)。
2. pi.rs argv 切换 + cli_image_input helper。
3. pi_history.rs 新格式解析。
4. 单测补齐 + 前端 gate vitest。
5. OpenSpec delta + `openspec validate` + matrix CI。
6. 实机验收 → verification.md → 按用户指示 commit。
