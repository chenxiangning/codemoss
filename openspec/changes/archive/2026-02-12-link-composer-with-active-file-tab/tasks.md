## 1. Composer 关联条（P0）

- [x] 1.1 [P0][depends: none] 透传 active file path 到 Composer。验证：Composer 可读取当前文件路径。
- [x] 1.2 [P0][depends: 1.1] 新增关联条 UI（文件名 + 完整路径 title + 开关）。验证：有 active tab 时显示，无 active tab 时隐藏。

## 2. 路径注入行为（P0）

- [x] 2.1 [P0][depends: 1.2] 发送时注入 `@file \`path\``（开关开启）。验证：发送文本前缀存在。
- [x] 2.2 [P0][depends: 2.1] 排队发送时同样注入。验证：queue 文本前缀存在。
- [x] 2.3 [P0][depends: 2.1] 开关关闭时不注入。验证：发送文本不含路径前缀。

## 3. 可见反馈闭环（P0）

- [x] 3.1 [P0][depends: none] editor 场景发送/排队后切回 chat。验证：回车后可立即看到消息反馈。

## 4. 视觉优化（P1）

- [x] 4.1 [P1][depends: none] 优化 Tab 选中态区分度。验证：未选中/悬停/选中三态可显著区分。

## 5. 质量门禁（P0）

- [x] 5.1 [P0][depends: 1.x,2.x,3.x,4.x] 执行 `typecheck + lint`。验证：无新增 error（允许仓库既有 warning）。
- [x] 5.2 [P0][depends: 5.1] 执行 `openspec validate link-composer-with-active-file-tab --strict`。验证：CLI 返回 success。

## 6. 验证记录（2026-02-12）

- [x] `npm run -s typecheck` 通过。
- [x] `npm run -s lint` 通过（无新增 error，保留仓库既有 warning）。
- [x] `openspec validate link-composer-with-active-file-tab --strict` 通过。
