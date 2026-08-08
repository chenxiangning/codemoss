## 1. Shared open helper

- [x] 1.1 `isHtmlFilePath` / `buildLocalFileUrl` / `openHtmlInBrowser`（内置 Browser Agent）
- [x] 1.2 util 单测：扩展名、POSIX/Windows 编码、中文/空格/`#?`、workspaceId 校验、失败传播

## 2. Browser Agent policy

- [x] 2.1 Rust `validate_browser_url_for_workspace` 放行 `file://` + `.html`/`.htm`
- [x] 2.2 `BrowserDock.normalizeUrlDraft` 保留 `file://` scheme

## 3. Entry surfaces

- [x] 3.1 `FileViewPanel` 内容区右键（edit/preview）
- [x] 3.2 文件树 Globe 行按钮 + 右键菜单；detached 保留 browser、隐藏 mention
- [x] 3.3 Git `DiffFileRow` Globe；单仓 + 多仓路径解析；deleted 隐藏
- [x] 3.4 i18n `files.openInBrowser`（10 locales）

## 4. Verification

- [x] 4.1 focused vitest：util + FileViewPanel open-in-browser + FileTreeRows（含错误 i18n / 全局 toast）
- [x] 4.2 `tsc --noEmit` / eslint 目标文件通过
- [x] 4.3 错误 UX：文件树改全局 toast；`formatOpenHtmlInBrowserError` + 10 locale keys
- [x] 4.4 人工冒烟与错误 toast 可读性：用户确认后收口；残留窗口已存在时 focus/导航另案
- [x] 4.5 focused vitest 19 项通过；openspec validate --strict 通过

## 5. OpenSpec

- [x] 5.1 proposal / design / tasks / delta specs（new + modified）
- [x] 5.2 `openspec/changes/README.md` active 表登记
- [x] 5.3 `openspec validate add-local-html-open-in-builtin-browser --strict`
- [x] 5.4 sync main specs 并 archive（`2026-08-08-add-local-html-open-in-builtin-browser`）
