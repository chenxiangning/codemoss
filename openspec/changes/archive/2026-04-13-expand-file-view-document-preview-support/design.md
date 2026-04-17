## Context

当前文件查看域已经有 `image / markdown / structured / code / text / binary-unsupported` 这一层 render kind，但对 `doc/docx/xls/xlsx/csv/pdf` 仍缺少受控的专用预览模型。现状里的几个问题已经很明确：

- `png/jpg/jpeg` 虽然已有图片预览，但没有被纳入“多格式文件查看能力”的统一矩阵。
- `pdf/doc/docx/xls/xlsx` 仍更接近“识别为二进制后直接 unsupported”这一类行为，缺少可扩展的 preview mode。
- `csv` 是文本文件，但用户预期通常是表格预览，不是纯文本代码视图。
- 主窗口和 detached file explorer 虽共享 `FileViewPanel`，但如果继续让 preview 分支直接长在组件里，后续引入 Word/PDF/Excel 会让大文件与跨窗口一致性问题成倍增长。

约束同样清楚：

- Tauri 前端不能为了方便直接开放任意文件系统读取能力。
- 阻塞型文档解析不能直接跑在主线程，也不能在 Tokio 主运行时里做长耗时同步操作。
- Windows/macOS 行为必须一致，不能让路径形态、文件名大小写或资源 URL 差异决定 preview 结果。
- 仓库已存在 large-file hard gate：[`/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml`](/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml) 在 CI 中固定执行 `npm run check:large-files:gate`，因此新增 viewer、state hook 和 payload loader 必须按模块拆分，不能把复杂度重新堆回单个超大文件。
- 这次提案必须优先做“收紧能力边界”，而不是看到支持名单就无脑把每种格式都扩成完整富预览；尤其 `doc` 只能承诺 best-effort 或显式 fallback，不能先承诺稳定高保真再把实现风险留给后面。

## Goals / Non-Goals

**Goals:**

- 为 `doc/docx/xls/xlsx/csv/pdf/png/jpg/jpeg` 建立显式 preview mode。
- 将 preview mode 判定、payload 加载、只读/编辑能力、fallback 语义统一到一套 render profile 契约中。
- 保持主窗口和 detached file explorer 的 preview parity。
- 把高成本文档解析与主线程 UI 渲染解耦，避免卡顿与空白面板。
- 把 Word / Excel / PDF / 图片的能力边界写清楚，避免后续实现阶段继续争议“到底是预览还是编辑”。

**Non-Goals:**

- 不支持 Office 富文档编辑。
- 不做系统级 Quick Look / shell 打开外部应用作为核心能力。
- 不引入 `ppt/pptx` 或其他额外预览域。
- 不把本提案扩大成完整文档管理或 OCR 方案。

## Decisions

### Decision 1: 在现有 render profile 上新增 preview mode 层，而不是直接把文件类型塞进组件分支

建议新增一层显式 preview mode：

```ts
type FilePreviewMode =
  | "image-preview"
  | "pdf-preview"
  | "document-preview"
  | "tabular-preview"
  | "markdown-preview"
  | "structured-preview"
  | "code-preview"
  | "text-preview"
  | "binary-unsupported";

type FileEditCapability = "full" | "plain-text" | "read-only";
```

`resolveFileRenderProfile()` 继续负责路径归一化与基础文件类型判断，但输出不再只说明“是不是 binary”，而要进一步声明具体 preview mode、preview source kind 和 edit capability。这样 `FileViewBody` 只消费 mode，不再自己猜文件类型。

建议增加 source kind：

```ts
type PreviewSourceKind =
  | "asset-url"
  | "file-handle"
  | "inline-bytes"
  | "extracted-structure";
```

备选方案：

- 方案 A：继续在 `FileViewBody` 里按扩展名分支。
- 方案 B：render profile 先决定 preview mode，视图层只做纯渲染。

取舍：采用方案 B。它更符合“边界先行”，也更适合主窗口 / detached 共用。

### Decision 2: 预览引擎按文件类型分层，不强求所有格式走同一种技术

首期技术矩阵如下：

| 文件类型 | Preview Mode | 渲染方式 | Edit Mode | 备注 |
|---|---|---|---|---|
| `png` / `jpg` / `jpeg` | `image-preview` | 继续使用 `convertFileSrc` + `<img>` | `read-only` | 保持现有图片预览，补充统一矩阵与 parity |
| `pdf` | `pdf-preview` | 前端 `pdf.js` 渲染分页预览 | `read-only` | 默认使用 file-backed/asset-backed 输入；失败时显式 fallback |
| `csv` | `tabular-preview` | 结构化表格预览 | `plain-text` | 预览看表格，编辑看原文 |
| `xls` / `xlsx` | `tabular-preview` | 工作簿/工作表表格预览 | `read-only` | 默认使用 file-backed 输入，worker 解析，首期不编辑 |
| `docx` | `document-preview` | 可读文档块预览（段落/标题/表格文本） | `read-only` | 首期不追求 Office 像素保真 |
| `doc` | `document-preview` 或显式 fallback | best-effort 文本/块预览 | `read-only` | 首期不承诺与 `docx` 同级稳定度 |

取舍理由：

- 图片最适合继续保留现有 asset URL 模式。
- PDF 用户预期是分页阅读，不是只抽文本；因此用 `pdf.js` 比统一文本提取更合适。
- `xls/xlsx/csv` 本质是表格数据，适合用统一 `tabular-preview`。
- `docx` 用户预期是“能读内容”，首期采用文档块预览即可，不引入重型 Office fidelity 方案。
- `doc` 历史格式风险高，首期只承诺 best-effort 或显式 fallback，不把不确定能力包装成稳定契约。

### Decision 3: 二进制文档 payload 读取必须走受限后端入口，解析按“前端 viewer / 后端提取”分工

为避免前端权限膨胀，也避免大二进制经 IPC 无界复制，新增一个 preview 专用边界，例如：

```rust
#[derive(Serialize)]
struct FilePreviewPayload {
    mode: String,
    source_kind: String,
    mime: Option<String>,
    asset_url: Option<String>,
    temp_file_path: Option<String>,
    bytes: Option<Vec<u8>>,
    extracted_document: Option<DocumentPreviewPayload>,
    truncated: bool,
}

#[tauri::command]
async fn load_file_preview_payload(
    workspace_root: String,
    file_path: String,
) -> Result<FilePreviewPayload, PreviewError>;
```

职责划分：

- 图片：优先返回受限 asset URL。
- PDF：优先返回受限 asset URL 或 file-backed 引用；仅在小文件预算内允许 inline bytes。
- `csv`：可继续走文本读取链路并在前端转为表格。
- `xls/xlsx`：优先返回 file-backed 引用，由 worker 解析；不默认传整包 bytes。
- `docx`：优先在 Rust 侧做受控文本/结构提取，再把结果作为 `document-preview` payload 返回。
- `doc`：优先尝试受控提取；若提取能力不足，则明确返回 fallback，而不是强行回传原始二进制。

为什么不采用“前端直接读本地文件”：

- 权限边界太松。
- 后续 detached/main 两个 surface 很难统一审计。
- Windows/macOS 文件路径和资源地址问题会散到多个调用点。
- 大体积 `Vec<u8>` 会把序列化、复制和内存峰值问题带进 IPC 边界。

### Decision 4: Win/mac 兼容逻辑必须前置到 preview payload 入口，而不是散落到各 viewer

兼容策略必须写死在 loader 边界，而不是交给 `pdf-preview`、`tabular-preview`、`document-preview`、`image-preview` 各自处理：

- Windows：
  - 路径归一化统一把 `\` 转为 `/`
  - 盘符路径与 UNC 路径都先转换成统一 lookup key
  - 文件名比较按大小写不敏感语义处理
  - `csv` 预览解析前统一兼容 `CRLF`
- macOS：
  - detached restore 恢复出的绝对路径与主窗口 workspace 相对路径都先走同一归一化入口
  - `convertFileSrc` 前必须先完成 URL-safe 编码，避免空格、中文和 `#` 等字符导致资源地址失配
  - 不允许因为 HFS/APFS 常见大小写行为差异，让同一文件在 preview mode 判定上漂移

建议前端类型边界：

```ts
type PreviewLookupContext = {
  normalizedPath: string;
  fileNameKey: string;
  comparablePathKey: string;
  platformFlavor: "windows" | "macos" | "other";
};
```

所有 viewer 只消费已经归一化后的 payload，不直接接触原始平台路径。

### Decision 5: 大文件降级采用静态预算，不依赖机器性能

预览预算建议：

- `pdf-preview`：默认只激活首屏页渲染，滚动懒加载；超过 `200` 页时先只提供分页阅读，不做全文搜索初始化。
- `tabular-preview`：默认最多渲染 `1000` 行 × `50` 列，每个工作簿最多首屏展示 `3` 个 sheet 的元信息；超限时显示截断提示。
- `document-preview`：默认最多返回 `2 MB` 提取结果或 `2000` 个文本块；超限时返回截断文档预览。
- `image-preview`：保留现有图片预览，但超大位图需限制初始缩放与元信息加载。
- `inline-bytes`：仅允许在明确定义的小文件预算内使用，例如 `<= 512 KB`；超限必须切换到 `asset-url`、`file-handle` 或 `extracted-structure`。

这样可以让 Windows 和 macOS 在同一文件上进入同一降级分支，而不是一台机器能开、另一台机器卡死。

### Decision 6: Preview runtime 资源必须显式回收

新增 viewer 不能只定义“怎么打开”，还必须定义“什么时候释放”：

- `pdf.js worker` 在 tab 切换、文件关闭、surface 销毁和 detached window 关闭时必须 terminate。
- `tabular-preview` worker 在解析取消或切换文件时必须 cancel/terminate。
- object URL、临时文件引用和缓存句柄必须在 viewer unmount 后释放。
- 任何进行中的 preview payload 请求都必须支持 cancellation，避免旧文件结果回灌到新 tab。

建议前端边界：

```ts
type PreviewRuntimeHandle = {
  dispose: () => void;
  cancelPendingWork?: () => void;
};
```

所有 viewer 组件必须实现等价的 cleanup 契约。

### Decision 7: Viewer 拆分必须以 large-file gate 为结构约束

这次不能只把功能做出来，还必须确保实现结构过门禁。具体约束：

- `FileViewPanel` 只保留 orchestration，不直接吞下 PDF、表格、Word 三类 viewer 的内部逻辑。
- 推荐新增独立组件，例如：
  - `FilePdfPreview.tsx`
  - `FileTabularPreview.tsx`
  - `FileDocumentPreview.tsx`
  - `useFilePreviewPayload.ts`
- 任一新增 viewer/hook 如果继续膨胀成超大文件，会被 [`/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml`](/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml) 里的 hard gate 拦下。

取舍：

- 方案 A：先做成一个大组件，后面再拆。
  - 交付快，但高概率在 CI 门禁与后续维护上反噬。
- 方案 B：按 preview mode 初始就拆 viewer。
  - 初始成本略高，但符合现有门禁与长期维护要求。

本次采用方案 B。

### Decision 8: `pdf.js` 打包与 worker 路径要先锁定，不把生产构建风险留到实现末期

`pdf.js` 不是“装上就能跑”的依赖，在 Tauri + Vite 下必须先锁定：

- worker 入口文件如何被 Vite 打包
- 生产构建里 worker URL 如何稳定引用
- CSP 是否允许对应 worker/resource 加载方式
- 主窗口与 detached window 是否共用同一 worker 资产路径

这部分不应留到最后手修。实现阶段必须把 `pdf.js` worker 打包策略当作独立任务验证。

## Risks / Trade-offs

- [Risk] `doc` 预览无法达到与 `docx` 相同保真度
  → Mitigation：在规范中把 `doc` 定义为“可读文档预览”，不是 Office fidelity 预览，并保留“外部打开”兜底动作。

- [Risk] 新增 PDF / 表格 / Word 三类解析链路后，`FileViewPanel` 再次膨胀
  → Mitigation：强制把 preview mode viewer 拆成独立视图组件，`FileViewPanel` 只做 orchestration。

- [Risk] 二进制 payload 读取扩大 Tauri 命令权限面
  → Mitigation：命令只接受工作区内路径，返回 preview 需要的最小 payload，不暴露任意文件系统浏览能力。

- [Risk] 大表格 / 大 PDF 在主线程解析导致 UI 卡死
  → Mitigation：`xls/xlsx/csv` 解析走 worker，PDF 渲染走懒加载页流，阻塞型提取走 Rust `spawn_blocking`。

- [Risk] Windows 路径大小写与 `convertFileSrc` 资源 URL 不一致导致两个 surface 行为漂移
  → Mitigation：所有 preview payload 请求统一先走路径归一化，再由单一 preview loader 生成结果。

- [Risk] 新增 Office/PDF/表格 viewer 后再次触发 large-file 治理告警
  → Mitigation：按 preview mode 拆 viewer 与 hook，并把 [`/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml`](/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml) 中的 `npm run check:large-files:gate` 纳入最终门禁。

- [Risk] `pdf.js` worker 或资源路径在生产构建中失效
  → Mitigation：将 worker 打包/CSP/路径校验列为独立设计与验证任务，不接受“开发环境可用”作为完成标准。

- [Risk] tab 切换或窗口关闭后残留 worker、object URL 或旧请求回灌
  → Mitigation：将 runtime cleanup 设计成 viewer 契约的一部分，并为 detached window 关闭场景补专门验证。

## Migration Plan

1. 先扩展 render profile 与 file view surface，使九种文件类型都能得到显式 preview mode。
2. 接入图片 / PDF / 表格 / Word 四类 viewer 组件，但先不替换现有文本/Markdown 分支。
3. 为主窗口和 detached file explorer 同步切换到 preview mode 驱动链路。
4. 先锁定 `pdf.js` worker 打包策略，再接 viewer，避免把生产构建风险后置。
5. 补齐 Windows/macOS 路径样例、`convertFileSrc` 资源地址样例和 `CRLF/LF` CSV 样例。
6. 跑通 [`/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml`](/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml) 对应的 `npm run check:large-files:gate`。
7. 若某一类 preview 引擎不稳定，可单独回退该 mode 到明确 fallback，不回退整个 render profile 契约。

## Open Questions

- `docx` 的首期提取引擎最终锁定为 Rust 侧提取器还是受控 JS 引擎，需要在实现前做一次小样本验证。
- `doc` 是否进入“best-effort preview + explicit fallback”而不是追求稳定块预览，需要在实现前正式冻结。
- PDF 首期是否需要文本搜索栏，还是只交付分页阅读与缩放；建议先不把搜索列为 P0。
- `csv` 编辑保存后，是否需要立即刷新 `tabular-preview` 结果；建议作为实现细节，默认需要。
