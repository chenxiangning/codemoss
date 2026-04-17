## 自动化验证留痕

### 已执行命令

- `npm run typecheck`
- `npm run lint`
- `npm run check:large-files:gate`
- `NODE_OPTIONS=--max-old-space-size=8192 npx vitest run src/features/files/utils/fileRenderProfile.test.ts`
- `NODE_OPTIONS=--max-old-space-size=8192 npx vitest run src/features/files/utils/fileViewSurface.test.ts`
- `NODE_OPTIONS=--max-old-space-size=8192 npx vitest run src/features/files/hooks/useFileDocumentState.test.tsx`
- `NODE_OPTIONS=--max-old-space-size=8192 npx vitest run src/features/files/hooks/useFilePreviewPayload.test.tsx`
- `NODE_OPTIONS=--max-old-space-size=8192 npx vitest run src/features/files/components/FileViewPanel.test.tsx`
- `NODE_OPTIONS=--max-old-space-size=8192 npx vitest run src/features/files/components/FilePdfPreview.test.tsx`
- `NODE_OPTIONS=--max-old-space-size=8192 npx vitest run src/features/files/components/FileTabularPreview.test.tsx`
- `NODE_OPTIONS=--max-old-space-size=8192 npx vitest run src/services/tauri.test.ts`
- `cargo test --manifest-path src-tauri/Cargo.toml resolve_workspace_preview_handle_keeps_file_backed_payload_bounded`
- `cargo test --manifest-path src-tauri/Cargo.toml resolve_external_preview_handles_respect_allowed_roots_and_openspec_aliases`

### 结果摘要

- TypeScript 类型检查通过。
- large-file hard gate 通过，未新增超大文件。
- ESLint 无 error；仍存在仓库既有 `react-hooks/exhaustive-deps` warnings。
- 预览契约、payload 边界、viewer 路由、请求取消、PDF cleanup、表格 stale request 防回灌测试均通过。
- Rust 侧 preview handle 边界测试通过，覆盖工作区约束与外部 OpenSpec 根别名场景。

## 主窗口 / Detached 手测矩阵

### 预览模式一致性

1. 在主窗口分别打开 `pdf/doc/docx/xls/xlsx/csv/png/jpg/jpeg`，确认进入预期 preview mode。
2. 从 detached file explorer 打开同一批文件，确认 preview mode 与主窗口一致。
3. 对包含空格、中文、URL 编码字符的 `png/jpg/jpeg/pdf` 路径重复上述验证，确认 `convertFileSrc` 资源可用。
4. 对 Windows 风格盘符路径、UNC 路径、大小写变体路径执行恢复链路，确认 preview mode 不漂移。

### 功能与降级

1. 打开 `docx`，确认显示结构化文档块。
2. 打开 `doc`，确认进入显式 fallback，而不是伪装成富预览。
3. 打开 `csv`，确认默认显示表格预览；切到文本编辑并保存后，重新回到预览能看到最新内容。
4. 打开大 `pdf/xls/xlsx/csv/docx`，确认出现分页懒加载或截断提示，而不是空白面板或卡死。

### 生命周期

1. 在 `pdf` 首屏渲染中切换到其他文件，确认旧结果不回灌。
2. 在 `xls/xlsx` 解析过程中切换到 `csv` 或关闭标签，确认旧表格结果不覆盖新文件。
3. 关闭 detached window，确认不再继续刷新旧 preview 结果。
