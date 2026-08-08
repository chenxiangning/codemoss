# Verification: add-local-html-open-in-builtin-browser

## Automated

| Check | Result | Notes |
|-------|--------|-------|
| `npx vitest run src/features/files/utils/openHtmlInBrowser.test.ts src/features/files/components/FileViewPanel.open-in-browser.test.tsx src/features/files/components/FileTreeRows.test.tsx` | PASS | 15 tests |
| `npx tsc --noEmit -p tsconfig.json` | PASS | 实现后全量 typecheck |
| eslint on touched FE files | PASS | max-warnings 0 |
| `openspec validate add-local-html-open-in-builtin-browser --strict --no-interactive` | PASS | artifacts 4/4 |

## Manual matrix（待用户）

| # | Step | Expected |
|---|------|----------|
| M1 | 打开 workspace 内 `*.html`，内容区右键 → 在浏览器打开 | 内置 Browser 窗口加载该文件 |
| M2 | 文件树 hover HTML 行 → Globe | 同上 |
| M3 | 文件树右键 HTML → 在浏览器打开 | 同上 |
| M4 | Git Changes 列表 HTML 行 → Globe | 同上；多仓时路径正确 |
| M5 | 非 HTML（`.ts`/`.md`）三入口均无项 | 无菜单/无图标 |
| M6 | 含中文或空格的 HTML 路径 | 可打开 |
| M7 | 断 Browser Agent / 无 workspace | 非阻塞错误提示 |

## Residual risks

- `file://` 静态预览：部分跨源资源失败属预期。
- tab 右键未覆盖。
- Browser Agent 窗口 label 已存在时当前映射为「窗口已打开」友好 toast；后续可做 focus + 导航复用（另 change）。

## Closure

- Main specs synced: `local-html-builtin-browser-open`（new）、`vibecoding-browser-agent`（file:// HTML policy）
- Archive: `openspec/changes/archive/2026-08-08-add-local-html-open-in-builtin-browser/`
