## Why

当前文件查看链路对文本与 Markdown 已形成基本能力，但对常见文档、表格、PDF 与图片文件仍缺少统一、可解释的预览契约。结果是 `doc/docx/xls/xlsx/csv/pdf/png/jpg/jpeg` 这些高频文件要么直接落入二进制 fallback，要么能力散落在局部分支里，主窗口与 detached window 后续也难以保证一致。

这已经不是“再补几个扩展名映射”能解决的问题。若不趁现在把文件查看能力抽象成明确的 preview mode 与受控加载边界，后面每多支持一种文件类型，都要重复扩展前端渲染、Tauri 读文件、安全 fallback 和跨窗口一致性，回归风险会持续放大。

## 目标与边界

### 目标

- 目标 1：为 `doc`、`docx`、`xlsx`、`xls`、`csv`、`pdf`、`png`、`jpg`、`jpeg` 明确建立文件查看支持，不遗漏任何一种类型；其中 `docx/xls/xlsx/csv/pdf/png/jpg/jpeg` 追求稳定内嵌预览，`doc` 至少必须有显式、可解释的受控结果。
- 目标 2：把这些文件类型的“渲染方式 + preview mode + edit mode + fallback”收口成可测试的统一契约，而不是散落在单个组件条件分支中。
- 目标 3：保证主窗口文件查看面板与 detached file explorer 对同一文件类型使用同一 preview mode 和同一降级语义。
- 目标 4：坚持 Tauri 边界最小化，避免让前端直接拿到超出工作区范围的任意文件访问能力。
- 目标 5：在 Windows 和 macOS 下保持一致行为，尤其是路径归一化、`convertFileSrc` 资源地址、大小写差异和大文件降级策略。
- 目标 6：所有实现拆分必须满足仓库门禁 [`/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml`](/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml) 的 hard gate，避免把新 preview viewer 再次堆回单个超大文件。

### 边界

- 本提案聚焦“文件查看与预览”，不扩展为 Office 在线编辑能力。
- 本提案不新增新的多窗口产品模型，仍沿用主窗口 + detached file explorer 的双 surface 语义。
- 本提案不追求 Word / Excel / PDF 的像素级原生 Office 保真，仅要求提供稳定、可读、可解释的桌面内预览。
- 本提案不引入依赖系统安装的外部应用链路，不要求 LibreOffice、Microsoft Office 或系统级 Quick Look 参与核心预览流程。
- 本提案不扩展到 `ppt/pptx`、音视频、压缩包等其他二进制预览域。
- 本提案不默认允许大体积原始二进制通过 Tauri IPC 整包传输；只有小文件或明确必要的受控场景才允许 bytes payload。

## 非目标

- 不重做文件树、tab、导航条或整体文件面板 UI。
- 不在本轮为 `doc/docx/xls/xlsx/pdf/png/jpg/jpeg` 增加“可编辑富文档”能力。
- 不以 shell 命令拉起外部转换器作为主预览方案。
- 不把“外部打开”定义为必须存在的主功能；它最多只是解析失败时的可选 escape hatch。
- 不把高频滚动、缩放、hover 等预览交互绑定到新的 Tauri 高频 IPC。

## What Changes

- 新增统一的多格式文件预览能力，为 `doc/docx/xls/xlsx/csv/pdf/png/jpg/jpeg` 建立显式 preview mode，而不是继续视为泛化二进制文件。
- 将文件查看能力从“扩展名 -> 零散分支”升级为“render profile -> preview mode -> payload loader -> fallback”，让主窗口与 detached window 共享同一决策入口。
- 为每种文件类型明确渲染方式：
  - `doc` / `docx`：`document-preview`
  - `xls` / `xlsx` / `csv`：`tabular-preview`
  - `pdf`：`pdf-preview`
  - `png` / `jpg` / `jpeg`：`image-preview`
- 为 preview-only 文件类型明确 edit mode 语义：`doc/docx/xls/xlsx/pdf/png/jpg/jpeg` 默认只读；`csv` 保留结构化预览 + 原始文本编辑双模式。
- 为大文档、大表格、大 PDF 和异常输入建立确定性降级策略，避免空白面板、卡死或未捕获异常。
- 为文件预览加载边界引入工作区校验、payload 上限与“小文件 bytes / 大文件 file-backed”分层，避免前端直接获得危险的任意路径读取能力，也避免大二进制在 IPC 中无脑复制。
- 明确 Win/mac 兼容写法：所有 preview payload 请求先做路径归一化；Windows 侧按大小写不敏感、反斜杠和 UNC/盘符路径兼容处理，macOS 侧按绝对路径恢复、URL 编码和 `convertFileSrc` 资源地址一致性处理；`csv` 预览需兼容 `CRLF` 与 `LF`。
- 将实现纳入仓库 large-file hard gate，明确以 [`/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml`](/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml) 中的 `npm run check:large-files:gate` 作为必须通过的门禁。
- 将 preview worker、object URL、临时文件引用和异步解析任务纳入生命周期治理，避免在 tab 切换或 detached window 关闭后残留资源。

## 技术方案对比与取舍

| 方案 | 描述 | 优点 | 风险 / 成本 | 结论 |
|---|---|---|---|---|
| A | 继续把每种文件类型加到 `binary/image/text` 条件分支里 | 交付快 | 渲染入口继续分散，Office/PDF/表格后续很快失控 | 不采用 |
| B | 建立统一 preview mode 契约，并按文件类型挂接专用 preview loader | 结构清晰，跨窗口一致性好，便于测试与后续扩展 | 需要补一层 render profile / preview loader 架构 | **本次采用** |
| C | 完全依赖系统默认应用或系统预览能力 | 前端实现最少 | 跨平台一致性差，Tauri 内嵌体验断裂，Windows/macOS 行为不可控 | 不采用 |

取舍：采用方案 B。先把文件查看能力抽象清楚，再分别接入 Word、表格、PDF、图片四类 preview loader，避免继续把“文件查看”做成不可维护的 if-else 集合。

## Capabilities

### New Capabilities

- `file-view-document-preview-modes`: 定义 `doc/docx/xls/xlsx/csv/pdf/png/jpg/jpeg` 的 preview mode、渲染方式、编辑能力、降级策略与跨窗口一致性要求。

### Modified Capabilities

无。

## Impact

- 受影响前端模块：
  - `src/features/files/utils/fileRenderProfile.ts`
  - `src/features/files/utils/fileViewSurface.ts`
  - `src/features/files/components/FileViewPanel.tsx`
  - `src/features/files/components/FileViewBody.tsx`
  - `src/features/files/components/FileExplorerWorkspace.tsx`
  - detached file explorer 相关状态与恢复链路
- 受影响 Tauri / Rust 边界：
  - 需要一个受工作区约束的 preview payload 读取入口，用于二进制文档的安全读取与必要提取。
  - 阻塞型文档提取必须走 `spawn_blocking`，避免卡住 Tokio runtime。
  - Preview payload 必须优先返回 file-backed / asset-backed 引用而不是大体积原始 bytes。
- 潜在新增依赖：
  - `pdf.js` 用于 PDF 页面预览
  - `SheetJS` 用于 `xls/xlsx/csv` 解析
  - Word 文档提取引擎需要在设计阶段锁定为 Rust 侧提取方案或受控 JS 方案
- 测试影响：
  - 需要新增 preview mode 判定测试、payload loader 边界测试、Windows/macOS 路径兼容测试，以及主窗口 / detached parity 测试。
  - 需要将新 viewer 组件与状态拆分纳入 [`/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml`](/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml) 的 hard gate 审查范围，确保 CI 持续执行 `npm run check:large-files:gate`。

## 验收标准

- `doc`、`docx`、`xlsx`、`xls`、`csv`、`pdf`、`png`、`jpg`、`jpeg` 九类文件都必须有明确、可解释的查看结果，不得遗漏；其中 `doc` 至少必须呈现 best-effort 预览或显式 fallback，不得伪装成稳定富预览。
- 主窗口与 detached file explorer 打开同一文件时，必须解析为相同 preview mode。
- `csv` 必须支持表格预览，并保留原始文本编辑能力。
- `doc/docx/xls/xlsx/pdf/png/jpg/jpeg` 必须表现为只读预览，不得误导用户进入不可保存的伪编辑态。
- 大文件或异常文件必须进入显式降级或 fallback，不得空白、不响应或抛未捕获异常。
- `pdf/xls/xlsx` 等高成本文件默认不得通过无界 bytes IPC 整包传输；若进入 bytes 模式，必须满足明确的小文件预算。
- Windows 风格路径、大小写变体路径与 macOS 恢复出的绝对路径，不得导致 preview mode 解析不一致。
- Windows 下的盘符路径、UNC 路径与大小写变体，macOS 下的恢复绝对路径、URL 编码路径与 `convertFileSrc` 生成地址，必须收敛到同一 preview payload 语义。
- 最终实现若引入新的 viewer、hook 或 loader 拆分，必须通过 [`/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml`](/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml) 中定义的 hard gate，不得通过新增超大文件换取实现速度。
- tab 切换、文件关闭、surface 销毁和 detached window 关闭后，不得残留 PDF worker、表格 worker、object URL 或未取消的解析任务。
