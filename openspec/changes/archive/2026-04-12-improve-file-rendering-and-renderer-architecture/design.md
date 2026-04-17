## Context

当前文件查看域已经形成了一个“共享 UI、分叉状态、集中渲染”的结构：

- 窗口级路由由 `router.tsx` 决定，`main` 渲染 `AppShell`，`file-explorer` 渲染 `DetachedFileExplorerWindow`。
- 主窗口文件会话状态由 `useGitPanelController` 管理，独立文件窗口会话状态由 `useDetachedFileExplorerState` 管理，两者都向 `FileExplorerWorkspace` 和 `FileViewPanel` 输送数据。
- 文件内容渲染、预览/编辑切换、CodeMirror、Markdown preview、structured preview、外部变更感知、Code Intel 导航等能力主要集中在 `FileViewPanel.tsx`。
- 文件类型判定与渲染能力目前分散在 `fileLanguageRegistry.ts`、`syntax.ts`、`codemirrorLanguageExtensions.ts`、`FileStructuredPreview.tsx` 与 `FileViewPanel.tsx` 中。

这套结构的优势是复用了主要 UI 组件，但代价也明显：

- 高热文件类型覆盖不完整，热门文本文件只能纯文本 fallback，或预览/编辑能力不对称。
- 语言判定、预览 renderer、编辑器扩展并非严格由一个共享契约驱动，继续扩展时容易漂移。
- `FileViewPanel` 已经同时承担“内容加载、内容渲染、编辑器能力、外部变更同步、导航跳转、fallback 处理”等多个职责，导致变更面过大。
- 主窗口与独立文件窗口共享渲染组件但不共享会话模型，任何渲染链路调整都需要考虑双 surface 一致性。

约束条件：

- 保持现有 Tauri IPC 边界稳定，避免为了渲染问题引入新的危险命令或扩大前端权限面。
- 保持当前文件打开流程、多标签、导航跳转、外部变更感知、Markdown 预览、独立文件窗口等行为可用。
- 优先复用现有 Prism、CodeMirror 和文件读取命令，不做一次性大重写。

## Goals / Non-Goals

**Goals:**

- 建立统一的文件语言判定与渲染策略模型，使 preview、edit、structured preview 和 fallback 共享同一来源。
- 补齐当前已冻结范围内的高频缺失或不完整文件类型支持，首期仅覆盖 `vue`、`php`、`rb`、`cs`、`dart`、`gradle`、`kts`、`ini`、`conf`、`.env`、`docker-compose.yml`。
- 将文件渲染链路拆分为更清晰的职责层，降低 `FileViewPanel` 的耦合度并控制后续扩展成本。
- 确保主窗口与独立文件窗口使用同一渲染能力基线，避免同类文件在两个 surface 中出现不一致表现。
- 提升渲染稳定性与性能，重点降低大文件、长文本、模式切换、窗口恢复和外部变更刷新场景下的风险。
- 在渲染契约层内建 Windows/macOS 路径兼容语义，避免跨平台路径形态差异造成语言判定漂移。

**Non-Goals:**

- 不重做文件树、主布局、独立窗口整体信息架构。
- 不引入新的多窗口产品语义，不支持无限制地新增 detached window 类型。
- 不在本轮引入新的 IDE 级能力，如编译诊断、运行、语言服务增强。
- 不新增大规模后端存储模型或重写现有文件读取/写入命令。
- 不将范围扩展到 `svelte`、`astro`、`svg` 双模式、Web Worker 预览流水线或新的配置文件专用 viewer。

## Decisions

### Decision 1: 引入统一的 `FileRenderProfile` 契约，作为所有渲染分支的唯一入口

设计一个面向文件路径和基础元信息的统一解析结果，例如：

- `kind`: `image | markdown | structured | code | text | binary-unsupported`
- `normalizedLookupPath`
- `filenameMatchKey`
- `previewLanguage`
- `editorLanguage`
- `structuredKind`
- `editCapability`: `full | plain-text | read-only`
- `fallbackBehavior`

建议的前端类型边界：

```ts
type FileRenderKind =
  | "image"
  | "markdown"
  | "structured"
  | "code"
  | "text"
  | "binary-unsupported";

type EditCapability = "full" | "plain-text" | "read-only";

type FallbackBehavior =
  | "plain-text-preview"
  | "plain-text-editor"
  | "binary-unsupported"
  | "image-preview";

interface FileRenderProfile {
  kind: FileRenderKind;
  normalizedLookupPath: string;
  filenameMatchKey: string;
  previewLanguage: string | null;
  editorLanguage: EditorLanguageId | null;
  structuredKind: "shell" | "dockerfile" | null;
  editCapability: EditCapability;
  fallbackBehavior: FallbackBehavior;
}
```

这层契约用于替代“多文件各自判断扩展名、各自决定 fallback”的现状。`fileLanguageRegistry.ts` 继续作为基础映射来源，但不再只返回零散语言标识，而是服务于更高层的 render profile 解析。

兼容约束：

- 在进入 render profile 前先归一化路径分隔符与 basename 提取逻辑，避免 `\\` 与 `/` 差异影响文件名规则。
- Windows 文件名优先规则按大小写不敏感语义处理，避免 `.ENV`、`Dockerfile`、`POM.XML` 因大小写变体错判。
- macOS 从 detached restore / absolute path 流程恢复出的路径也必须经过同一归一化步骤，避免 surface 间路径形态不同导致 render kind 漂移。

备选方案：

- 方案 A：继续保留现有 `languageFromPath + isBinaryPath + isImagePath + resolveStructuredPreviewKind` 组合判断。
  - 优点：改动最小。
  - 缺点：判断逻辑继续分散，补一种语言仍要改多处。
- 方案 B：引入统一 render profile。
  - 优点：语言判定、preview/editor/fallback 进入同一决策树，利于测试与扩展。
  - 缺点：需要先做一次判定层重构。

取舍：采用方案 B。

### Decision 2: 将 `FileViewPanel` 拆成“数据层 + 策略层 + 视图层”，但保持对外 props 兼容

`FileViewPanel` 不再继续承担所有横切逻辑，而拆为三层：

- `useFileDocumentState`
  - 负责文件读取、写入、dirty/truncated 状态、外部内容快照。
- `useFileRenderProfile`
  - 负责根据 `filePath + workspace context` 解析 render profile。
- `useFileExternalSync` / `useFileNavigation`
  - 负责外部变更感知与 Code Intel 导航。
- 视图层组件
  - `FileBinaryFallbackView`
  - `FileImagePreviewView`
  - `FileMarkdownView`
  - `FileStructuredView`
  - `FileCodeView`
  - `FileEditorView`

`FileViewPanel` 自身保留为 orchestration 组件，对现有调用方维持大体相同的 props 语义，降低主窗口和 detached window 的接入风险。

备选方案：

- 方案 A：直接重写 `FileViewPanel`。
  - 风险：一次性回归面过大。
- 方案 B：在保留对外接口的前提下拆内部模块。
  - 风险可控，方便逐步替换与回归。

取舍：采用方案 B。

### Decision 3: 主窗口与独立文件窗口共享渲染能力，但暂不强行合并会话状态模型

当前主窗口和独立窗口的问题本质不同：

- 渲染能力应完全共享。
- 会话状态模型虽然相似，但直接合并会牵动 `AppShell`、`useGitPanelController`、detached session 恢复和 live edit preview，风险较高。

因此本次设计采用“先统一渲染契约，后观察是否继续统一会话模型”的策略：

- `useGitPanelController` 和 `useDetachedFileExplorerState` 继续各自维护 tabs/active file/navigation。
- 两者都只向统一 render profile + 分层 `FileViewPanel` 输送状态。
- 独立窗口恢复机制仍使用现有 snapshot/event 双通道，但渲染结果必须与主窗口走同一能力链路。

备选方案：

- 方案 A：本次同步统一 file session reducer。
  - 优点：理论上更整洁。
  - 缺点：影响主窗口行为面过大。
- 方案 B：本次只统一渲染能力，不统一状态模型。
  - 优点：风险更低，更符合“补能力 + 最小重构”目标。

取舍：采用方案 B。

### Decision 4: 文件类型扩展采用“冻结范围、优先接通已有渲染引擎，再扩结构化预览”的顺序

按优先级区分三类扩展，且首期范围冻结，不再顺手扩展额外语言族：

1. 已有 preview 引擎支持、但 registry 未接通
   - 如 `rb` 等。
2. 可先落纯代码高亮/纯文本编辑，再评估专用编辑器支持
   - 如 `vue`、`php`、`cs`、`dart`、`gradle/kts`。
3. 适合结构化预览的高频配置文件
   - 如 `docker-compose.yml`、`.env`、`package.json`、`tsconfig.json`、`Cargo.toml`。

这意味着首期不是“所有类型都追求完整编辑器能力”，而是优先保证：

- 有清晰的渲染结果
- 有稳定 fallback
- 能在 preview/edit 中保持可解释的一致性

收口策略：

- `vue` 在首期只要求接入统一代码预览/编辑能力，不引入额外 SFC 专用 renderer。
- `.env`、`ini`、`conf` 首期只要求明确代码/文本渲染策略，不引入新的配置表单式 viewer。
- `docker-compose.yml` 仅在复用现有 YAML/structured 能力可控时接入，不为单一文件类型新增新的 preview 产品形态。
- `svelte`、`astro`、`svg` 双模式切换明确延后到后续独立 change。

首期 frozen strategy matrix：

| 文件类型 | 路径判定基准 | Preview 策略 | Edit 策略 | Fallback / 备注 |
|---|---|---|---|---|
| `vue` | 扩展名 | `code` + Prism 高亮 | `plain-text` editor | 不引入 SFC 专用 editor |
| `php` | 扩展名 | `code` + Prism 高亮 | `plain-text` editor | 先保证可读代码预览 |
| `rb` | 扩展名 | `code` + Prism 高亮 | `plain-text` editor | 复用 Prism ruby |
| `cs` | 扩展名 | `code` + Prism 高亮 | `plain-text` editor | 首期不补专用 CodeMirror |
| `dart` | 扩展名 | `code` + Prism 高亮 | `plain-text` editor | 首期不补专用 CodeMirror |
| `gradle` | 扩展名 | `code` + 文本高亮优先 | `comment-aware` Groovy editor | 使用现有 legacy mode，优先补 `//` 注释与基础语法着色 |
| `kts` | 扩展名 | `code` + Prism kotlin | `comment-aware` Kotlin editor | 使用现有 legacy mode，优先补 `//` 注释与基础语法着色 |
| `ini` | 扩展名 | `code`/`text` 可读预览 | `comment-aware` properties editor | 重点保证 `#` 注释与 key/value 着色，不进入结构化 viewer |
| `conf` | 扩展名 | `code`/`text` 可读预览 | `comment-aware` properties editor | 仅保证通用配置文件注释与 key/value 可读，不做语义细分 |
| `.env` | 文件名优先 | `code`/`text` 可读预览 | `comment-aware` properties editor | 重点保证 `#` 注释与 env key/value 可读，不进入结构化 viewer |
| `docker-compose.yml` | 文件名优先 + YAML | `code` + YAML 预览 | `full` YAML editor | 不新增 docker-compose 专用 structured renderer |

判定原则：

- 能复用现有 Prism 语言时，优先给 `code` preview。
- 能复用仓库内现有 lightweight CodeMirror/legacy mode 时，优先补 comment-aware editor；只有无法低风险接入时才保留 `plain-text` editor。
- `docker-compose.yml` 首期依赖现有 YAML 能力；若文件名命中但内容异常，仍应回退到通用 YAML/text 结果，而不是专用异常分支。

备选方案：

- 方案 A：优先补 CodeMirror 语言扩展。
  - 会导致 preview/editor 继续不平衡。
- 方案 B：优先把 render profile 和 preview/fallback 走通，再补 editor capability。

取舍：采用方案 B。

### Decision 5: 渲染性能优化以“避免高频主线程重算”和“避免高频 IPC”为原则

文件渲染域的主要性能风险不在后端，而在前端：

- 大文件预览按行高亮时的主线程压力。
- Markdown / structured preview 切换时的重复解析。
- 高频切换 tab、外部变更刷新带来的重复渲染。

本次设计采用以下原则：

- 预览策略只在文件切换或内容版本变化时重算，不在普通 UI 状态变化时重算。
- 语言判定与 render profile 解析结果可 memoize，避免多组件重复按路径解析。
- 保持现有文件读取命令复用，不在滚动、hover、拖拽等高频交互中新增 IPC。
- 对大文本预览保留安全降级空间，如必要时限制高亮成本或切换为 plain text preview。

不在本轮引入 Web Worker 或新的后端预处理流程，但设计上保留后续将高成本 preview 计算迁入 worker 的空间。

首期性能 guardrail 采用静态阈值，而不是设备相关的耗时阈值：

- 现有 Rust 文件读取链路在 `400_000` bytes 时已进入 `truncated` 语义；本次前端预算必须与该硬边界兼容，而不是另起一套更大的读取假设。
- 采用 `bytes` 与 `line count` 双阈值，谁先命中谁触发降级。原因是同样大小的文件，长行和超多行对 React/CodeMirror/Markdown renderer 的压力模型不同。
- 首期不使用“渲染超过 N ms 再降级”这类动态阈值，避免不同 Win/mac 机器性能差异导致行为漂移、测试不稳定和用户感知不一致。

建议阈值：

| 渲染路径 | 富渲染允许区间 | 触发降级条件 | 降级结果 |
|---|---|---|---|
| Code preview | `<= 200_000 bytes` 且 `<= 8_000` 行 | 超过任一阈值，或后端 `truncated=true` | 关闭高成本逐行高亮，回退为低成本 plain-text/code-style preview |
| Markdown preview | `<= 150_000 bytes` 且 `<= 5_000` 行 | 超过任一阈值，或后端 `truncated=true` | 保留文件视图边界，回退到低成本可读 Markdown/file preview，不进入 message renderer |
| Structured preview | `<= 120_000 bytes` 且 `<= 3_000` 行 | 超过任一阈值，或后端 `truncated=true` | 回退到通用 code/text preview，不继续走结构化卡片解析 |
| Editor mode | `truncated=false` | `truncated=true` | 保持现有“文件过大不可编辑”语义；不为了大文件强开不完整编辑 |

取值依据：

- `400_000` bytes 是后端读取硬上限，前端富渲染阈值必须明显低于它，给 React 渲染、Prism 高亮和 Markdown/structured 解析留出安全余量。
- Markdown 和 structured preview 的预算低于 code preview，因为它们除文本本身外还有 AST/块级结构或卡片布局成本。
- 这些阈值是首期保守预算，目标是先稳定渲染链路；若后续需要更高吞吐，应通过 worker 化或专门优化 change 提升，而不是直接放大当前阈值。

防御性约束：

- 如果文件大小低于 bytes 阈值，但单行极长导致交互仍明显退化，仍允许通过 `line count` 或后续“max line length” 补充规则进入降级。
- 如果 Win/mac 在相同文件上因为换行差异导致行数轻微不同，bytes 阈值仍可作为第二道稳定护栏，不会让两个平台出现完全不同的 renderer 选择。

### Decision 6: Tauri 边界保持稳定，Rust 侧只承接现有文件读写与窗口资源清理责任

本变更的核心在前端渲染架构，而不是扩大 Rust 能力面。因此：

- 文件读取、写入、外部 spec 读取、外部绝对路径读取继续使用现有命令。
- detached external change monitor 继续使用现有 `configure/clear` 命令，不新增新的前端直接危险命令。
- 独立窗口关闭时的 Rust 资源释放契约保持现状，前端重构不得改变其清理时机。

这符合 Tauri v2 的边界要求：前端不因“想补渲染”而直接拿到更危险的文件系统权限。

### Decision 7: 重构必须服从仓库 large-file governance，禁止以新的超大文件承接复杂度

仓库已经通过 `.github/workflows/large-file-governance.yml` 执行 `npm run check:large-files:gate`，当前硬门禁来自 `package.json` 中的 `--threshold 3000 --mode fail`。

因此本次重构除了“职责拆分”之外，还必须满足：

- 不允许把 `FileViewPanel` 的复杂度平移到另一个同等级超大文件。
- orchestration、hook、view 拆分应按职责落到多个文件，并持续关注 `2500` 行预警与 `3000` 行 fail 门限。
- 若拆分后仍有单文件逼近门限，必须继续拆，而不是用注释或折叠掩盖复杂度。

## Risks / Trade-offs

- [渲染判定统一后误伤既有类型] → 先以 additive 方式接入 render profile，保留旧行为回归测试，对已支持类型建立基线样例。
- [`FileViewPanel` 拆分过程引入行为回退] → 保留外层组件接口不变，先内部抽 hook 和子视图，再逐步迁移分支。
- [主窗口与独立窗口行为仍有少量状态不一致] → 本次明确只统一渲染层，不承诺统一 session 层；后续如仍存在问题，再单开 change 处理。
- [新增语言支持导致依赖或打包体积上升] → 优先复用现有 Prism/CodeMirror 能力；新增依赖必须能解释收益且范围受控。
- [大文件高亮仍可能造成卡顿] → 首期通过 render profile 和 preview 降级策略控制成本；如果指标仍不稳，再引入 worker 化方案。
- [Markdown/structured preview 增强时污染消息渲染域] → 保持文件预览专用 renderer 边界，不回流到 message renderer。
- [Windows/macOS 路径语义导致文件名规则失真] → 在 render profile 前统一做路径归一化与平台兼容测试，避免 basename/大小写分支漂移。
- [拆分后仍触发 large-file governance gate] → 在实现过程中持续跑 large-file 检查，避免最后阶段集中返工。

## Migration Plan

1. 冻结首期支持矩阵与 out-of-scope 清单，并先补齐 Windows/macOS 路径兼容样例。
2. 建立 `FileRenderProfile` 解析层，并以不破坏旧接口的方式接入 `FileViewPanel`。
3. 将 `FileViewPanel` 内的图片、Markdown、structured、code、editor、binary fallback 分支逐步抽成子视图或子 hook，同时避免产生新的超大文件。
4. 先补 `fileLanguageRegistry` 与 `codemirrorLanguageExtensions` 中已冻结范围内的缺口，再补结构化预览候选文件。
5. 用主窗口文件视图完成回归后，再用独立文件窗口验证同类文件的渲染一致性，并覆盖 Windows/macOS 路径形态差异。
6. 在实现过程中持续执行 large-file governance 检查；若出现回归，优先回退到旧 render branch，而不是回退整个文件会话逻辑。

回滚策略：

- 回滚点应保持在前端渲染层。
- 不依赖新增后端命令，因此不需要 Rust 侧 schema 或数据迁移回滚。
- 若某一类新文件支持表现不稳定，可按类型关闭或回退该类型的 render profile 规则，而不影响其它已稳定能力。

## Execution Slices

为避免主窗口、detached、Markdown 稳定性和组件拆分互相踩踏，实施顺序锁定为下列四个 slice。每个 slice 完成前都必须先通过固定样例矩阵，再进入下一个 slice。

### 固定样例矩阵

| 样例文件 | 目标 render kind / editor 基线 | 主要风险 |
|---|---|---|
| `README.md` | Markdown preview / source edit / low-cost degrade | 空白面板、切换后 stale Markdown、错误退回 message renderer |
| `Dockerfile` | structured 或 code fallback 基线 | 主窗口与 detached render kind 漂移 |
| `docker-compose.yml` | filename-priority + YAML render profile | 文件名优先规则失效、detached parity 漂移 |
| `.env.local` | filename-priority + comment-aware properties editor | `#` 注释丢失、Windows 大小写或路径形态判定漂移 |
| `build.gradle.kts` | comment-aware Kotlin editor | `//` 注释回退为纯文本、切 mode 后语言状态泄漏 |

### Slice 顺序

| Slice | 范围 | 进入条件 | 完成判据 | 回滚点 |
|---|---|---|---|---|
| Slice A | 主窗口 render profile 主链路收口 | `FileRenderProfile` 已稳定驱动 `FileViewPanel` | 固定样例矩阵在主窗口的 render kind / fallback / comment-aware editor 一致 | 仅回退主窗口 render-body 选择逻辑，不回退 language registry |
| Slice B | detached surface parity 与 restore 对齐 | Slice A 通过 | 固定样例矩阵在 detached 与 main 的 render kind、fallback class、edit capability 一致 | 仅回退 detached render binding 或 restore hydration，不回退 main surface |
| Slice C | Markdown 稳定性 + `FileViewPanel` 职责拆分 | Slice B 通过 | `README.md` 等 Markdown 文件在切 tab、切 mode、大文档和 `truncated=true` 下无空白与 stale 内容，且组件拆分后 large-file gate 不超限 | 可单独回退 Markdown dedicated branch 或某个拆出的 sub-layer，不回退 render profile 契约 |
| Slice D | IPC 审计 + 最终门禁 | Slice C 通过 | 无新增高频 IPC，固定样例矩阵手测与自动化门禁全部通过 | 如发现高频 invoke，可仅回退新增 render-state 同步逻辑 |

### 主窗口 / Detached 手测矩阵

| 场景 | Main | Detached | 通过标准 |
|---|---|---|---|
| 打开固定样例文件 | 必测 | 必测 | render kind、fallback class、comment-aware editor 一致 |
| preview/edit 切换 | 必测 | 必测 | 不空白、不残留上一文件的语言标记或控制条 |
| tab 切换 | 必测 | 必测 | 不泄漏上一 tab 的 renderer 状态 |
| session restore / absolute path restore | 可选 | 必测 | 恢复后直接渲染当前 active file，无需手动 reopen |
| external refresh / content refresh | 必测 | 必测 | 仅在显式刷新或现有外部变更流程下更新，不触发额外高频 IPC |

### IPC 审计清单

- render profile 解析、mode 切换、surface 切换、降级决策必须保持在前端本地状态内完成。
- 允许继续复用现有“打开文件 / 显式刷新 / 保存 / 外部变更同步” IPC；禁止新增按 `scroll`、`hover`、`drag`、syntax repaint 触发的 `invoke`。
- 若为了稳定性需要额外同步状态，优先使用 React 本地 state、memoized render profile 和既有事件负载，不新增新的 Tauri command。
- 最终门禁必须显式检查“无新增高频 IPC”这一条，而不是只看 UI 肉眼可用。

## Locked Assumptions

- `svelte`、`astro`、`svg` 双模式不进入本次范围，避免提案继续外扩。
- 首期优先复用现有 preview/editor 能力，不为单一语言或配置文件引入新的专用 renderer 家族。
- Windows/macOS 路径兼容属于本次渲染契约的一部分，不能留到后续再补。
- 大文件与长文本处理以“可读降级 + 不阻塞 + 不新增超大文件”为实现约束；若后续需要更强性能预算，再单开 change。
