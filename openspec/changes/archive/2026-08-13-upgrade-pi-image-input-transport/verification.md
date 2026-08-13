# upgrade-pi-image-input-transport — Verification

## 实现落点(mossx 仓,未 commit)

| 文件 | 变更 |
| --- | --- |
| `openspec/specs/engine-capability-matrix/fixtures/matrix.json` | pi `image.input` `"compat-input"` → `"supported"` |
| `src/features/engine/generated/engineCapabilityMatrix.generated.ts` | regen(2 行) |
| `src-tauri/src/engine/capability_matrix.generated.rs` | regen(2 行) |
| `src-tauri/src/engine/capability_matrix.rs` | 内嵌测试 `pi_supports_image_input_via_at_file_transport` |
| `src-tauri/src/engine/cli_image_input.rs` | 新增 `pi_image_file_args` + `split_pi_file_attachments_for_display`;`build_pi_prompt_with_images` 退役为 `#[cfg(test)]` legacy round-trip 专用 |
| `src-tauri/src/engine/pi.rs` | `build_command` 图片改 `@<abs path>` argv(prompt 前),移除注入调用;新增 3 个 argv 单测 |
| `src-tauri/src/engine/pi_history.rs` | user 分支:先旧注入 marker split,未命中再走 `<file name>` split;image blocks 不进投影;新增 @file 时代 + 旧格式混排加载测试 |
| `src/features/engine/utils/engineImageInput.test.ts` | it.each / supported 列表补 pi |
| `src/features/threads/hooks/useThreadMessaging.test.tsx` | 「does not block sends with non-empty images」it.each 补 pi |
| `docs/research/mossx-multi-cli-provider-session-foundation-design.md` | 校准表新增「Pi 图片输入 transport(2026-08-14 校准)」行(ADR 校准回写 Gate) |

## 自动化验证(2026-08-14)

| 项 | 结果 |
| --- | --- |
| `openspec validate upgrade-pi-image-input-transport --strict` | ✅ valid |
| `npm run check:engine-capability-matrix`(fixture/TS/RS 三端一致) | ✅ ok (15 capabilities) |
| `npm run check:engine-adapter-registry` | ✅ ok (7 built-ins) |
| `npx tsc --noEmit` | ✅ 零输出 |
| `cargo check --lib`(本 change 文件) | ✅ 无新增 warning(`pi.rs:133` 为 HEAD 预存) |
| `cargo test --lib -- engine::cli_image_input engine::pi engine::pi_history engine::capability_matrix` | ✅ 33 passed / 0 failed(新增 9 例:argv 3、split 5、history 1,另 legacy round-trip 1) |
| vitest:engineImageInput / engineCapabilityMatrix / useThreadMessaging / ChatInputBoxAdapter | ✅ 188/191;3 failed 为**预存失败**(已在改动前基线复跑确认同样 3 例:racing Shared V2 submit、Shared V0 rollback target、codex retry 5s timeout),与本 change 无关 |

## 与验收标准对照

1. ✅ composer 粘贴截图不弹「不支持图片」+ 模型直接识图 — 用户 2026-08-14 实机验收通过
2. ✅(单测)argv 含 `@<abs path>` 且在 prompt 前;prompt 不含注入 marker / read-tool 指令
3. ✅(单测)history 新格式解析「文本 + 路径」;旧注入 marker 回归不丢
4. ✅(单测)空文本附图走 `@file` + 空 prompt;全失败 → 发送前明确 Err(`none of the attached images`)
5. ✅ matrix 三端一致 + CI 校验绿;Rust/前端测试绿(除预存 3 例)

## 预存问题(不属本 change)

- `useThreadMessaging.test.tsx` 3 例失败(改动前基线同现):racing Shared V2 submit、Shared V0 rollback、codex retry timeout。
- 工作区存在其他 session 的未提交改动(`BashToolGroupBlock.*`、`update/generated/index.json`),commit 时不得混入。

## 收口 review(2026-08-14,用户实机验收通过后)

- diff 全量过目:transport / history / matrix / 测试 / ADR 校准行,无越界改动。
- 边界说明(不阻塞):`resolve_existing_image_files` 不校验 MIME(跨 engine 既有边界,composer 入口为图片专用);同名图片附件发送/历史两端 dedupe,与 grok 一致。
- 预存 3 例 vitest 失败与 `pi.rs:133` warning 均已在 HEAD 基线确认,与本 change 无关。

## 待办

- [x] 5.3 已 commit:代码 `a371b75da` feat(engine),openspec 归档 `00712d4c9` docs(openspec);均未混入其他 session 的工作区改动
- [ ] 5.4 pi fork 仓 `feat/interactive-image-attachments` 废弃改动清理(等用户确认)
