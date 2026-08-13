# upgrade-pi-image-input-transport — Tasks

> 全部改动在 mossx 仓。遵守 matrix 治理:generated 文件只能由 `scripts/check-engine-capability-matrix.mjs --write` 生成。

## 1. capability matrix 解锁(前端 gate 放行)

- [x] 1.1 `openspec/specs/engine-capability-matrix/fixtures/matrix.json`:pi `image.input` → `"supported"`
- [x] 1.2 `scripts/check-engine-capability-matrix.mjs --write` 再生成 TS/RS generated
- [x] 1.3 `npm run check:engine-capability-matrix` 三端一致校验绿
- [x] 1.4 `capability_matrix.rs` 内嵌测试同步(pi image.input 断言)
- [x] 1.5 前端 `engineImageInput` vitest:pi → true 用例;检查 composer/useThreadMessaging 既有 mock 中 pi=compat 的断言并同步

## 2. pi transport 切换 `@file`(`src-tauri/src/engine/pi.rs` + `cli_image_input.rs`)

- [x] 2.1 `cli_image_input.rs` 新增 `pi_image_file_args(image_files: &[PathBuf]) -> Vec<String>`(`@<abs path>` 组装)
- [x] 2.2 `pi.rs build_command`:移除 `build_pi_prompt_with_images` 调用,图片非空时在 prompt arg 前插入 `@file` args;`resolve_existing_image_files` 保留
- [x] 2.3 `build_pi_prompt_with_images` 退役为 history 专用(保留函数与 marker 常量,清理发送侧引用)
- [x] 2.4 Rust 单测:多图顺序、空文本附图、含空格/非 ASCII 路径、data URL materialize、全失败 Err、部分失败 warn

## 3. pi history 新格式解析(`src-tauri/src/engine/pi_history.rs`)

- [x] 3.1 `cli_image_input.rs` 新增 `split_pi_file_attachments_for_display(text) -> (String, Vec<String>)`:提取 `<file name="X">...</file>`(XML attr unescape、dedupe、按出现顺序),剥离标签得可见文本
- [x] 3.2 user 分支:先旧 marker split,未命中再走新 split;image content blocks 忽略(base64 不进投影)
- [x] 3.3 Rust 单测:单图/多图/纯图无文本/带 resize hints inner/旧 marker 回归/普通文本不剥离

## 4. OpenSpec 与文档

- [x] 4.1 `specs/engine-image-input-boundary/spec.md` delta 定稿(本 change 目录内)并 `openspec validate upgrade-pi-image-input-transport --strict --no-interactive` 绿
- [x] 4.2 检查基石 ADR 校准表是否含 pi image transport 条目;若有,收口前回写校准行(附本 change id)

## 5. 验收

- [ ] 5.1 `cargo test`(相关模块)与受影响 vitest 全绿
- [ ] 5.2 实机验收(macOS):pi engine + k3 粘贴截图发送(模型直接识图)、空文本附图、历史 reload 新格式、旧 session 混排、composer 不再弹「不支持图片」
- [x] 5.3 回填 verification.md;已 commit `a371b75da` + `00712d4c9`(未混入无关 diff)
- [ ] 5.4 用户确认后处理 pi fork 仓 `feat/interactive-image-attachments` 工作区的废弃改动
