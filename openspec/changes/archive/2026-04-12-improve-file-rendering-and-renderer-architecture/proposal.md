## Why

当前文件查看链路已经具备基础预览、编辑、Markdown 渲染和独立文件窗口能力，但“语言覆盖不完整 + 渲染职责分散 + 主窗口/独立窗口状态分叉”开始形成组合性问题。结果是：一批高频文本文件只能纯文本 fallback 或编辑/预览能力不对称，`FileViewPanel` 承担过多职责，渲染流程在主窗口与独立文件窗口之间虽然复用 UI，却没有形成稳定、可扩展的共享契约。

这个问题已经不再是单点补语言映射就能长期解决的阶段。若继续以补丁方式扩展，只会进一步加重 `language registry / preview renderer / editor extension / detached surface` 之间的漂移，后续每新增一种文件类型或预览能力，都要重复修改多处并放大回归风险。

## 目标与边界

### 目标

- 目标 1：补齐当前高频但缺失或不完整的文本文件渲染能力，且将首期范围明确冻结为已讨论的热门语言与配置文件类型。
- 目标 2：统一文件渲染相关的职责边界，收敛语言判定、预览渲染、编辑器扩展、独立窗口渲染能力之间的契约。
- 目标 3：提升文件预览与编辑链路的稳定性，降低切换文件、切换模式、切换窗口时的空白渲染、错误回退和状态漂移风险。
- 目标 4：在不破坏现有文件打开、多标签、导航跳转、外部变更感知等行为的前提下，为后续继续扩展文件类型与 renderer 能力建立可维护结构。
- 目标 5：对首期冻结范围内的高频配置文件，在编辑模式下优先提供 comment-aware 轻量语法高亮，至少覆盖 `#` 或 `//` 注释与基础 key/value 或脚本结构可读性，而不是长期停留在无注释高亮的纯文本编辑体验。

### 边界

- 首期聚焦文本文件渲染、渲染流程、渲染稳定性与必要重构，不重做整体文件浏览 UI。
- 首期不引入新的多窗口产品模型，仍沿用现有 `main` 与 `file-explorer` 双 surface 语义。
- 首期不承诺为所有语言提供完整 IDE 级语义，仅保证预览/编辑渲染能力、统一 fallback 与可持续扩展结构。
- 首期不承诺为所有语言提供完整 IDE 级语义，但若仓库内已存在可复用的轻量 CodeMirror/legacy mode，则配置文件编辑链路应优先接入 comment-aware 高亮，而不是继续退化为纯文本编辑。
- 首期新增覆盖范围冻结为 `vue`、`php`、`rb`、`cs`、`dart`、`gradle`、`kts`、`ini`、`conf`、`.env`、`docker-compose.yml`；`svelte`、`astro`、`svg` 双模式等额外诉求不在本次提案内。
- 首期兼容性重点仅覆盖与本能力直接相关的 Windows/macOS 路径、文件名与恢复路径语义，不扩展到新的 watcher 模型或新的 detached 产品形态。
- 保持现有 Markdown、图片预览、独立文件窗口、文件外部变更感知等已上线能力可用，不允许通过重构牺牲既有功能。

## 非目标

- 不重做主窗口或独立文件窗口的视觉设计与交互信息架构。
- 不扩展新的二进制预览域（例如音视频、压缩包、Office 文档的专用 viewer）。
- 不在本轮引入新的编辑器内 LSP/编译/运行能力。
- 不通过一次性大爆炸重写替换整个文件视图模块。
- 不在本轮补入 `svelte`、`astro`、`svg` 源码/图片双模式、Web Worker 渲染流水线或新的结构化配置 viewer 产品形态。

## What Changes

- 补齐当前高频但缺失或不完整的文件渲染覆盖，优先针对 `vue`、`php`、`rb`、`cs`、`dart`、`gradle/kts`、`ini/conf/.env`、`docker-compose.yml` 等热门语言或配置文件建立明确渲染策略。
- 收敛语言判定规则，确保预览高亮、编辑器扩展、结构化预览和安全 fallback 共享统一来源，而不是继续各自演进。
- 对已冻结范围内的配置文件编辑体验补齐最低可用标准：在不引入新专用 renderer 家族的前提下，优先复用仓库已有的轻量语法模式，让 `.env`、`ini`、`conf`、`gradle`、`kts` 等文件在编辑模式下至少具备注释高亮和基础结构可读性。
- 为主窗口文件视图与独立文件窗口建立共享的渲染能力契约，避免同一文件类型在两个 surface 中出现行为不对称。
- 将 Windows/macOS 相关的路径分隔符、basename 提取、文件名优先匹配和绝对路径恢复语义纳入统一判定契约，避免同一文件因路径形态不同出现渲染不一致。
- 对文件渲染链路做必要重构，拆分过载组件中的渲染职责、状态职责和外部同步职责，降低 `FileViewPanel` 一类大组件的耦合度。
- 优化渲染性能与稳定性，重点覆盖大文件/长文本预览、Markdown/结构化预览切换、tab 切换、模式切换、外部变更刷新与独立窗口恢复等场景。
- 明确未知文件类型与不支持文件类型的退化语义，保证始终存在可解释、可恢复的 fallback，而不是空白、误判或未捕获异常。
- 重构过程必须遵守仓库 large-file governance 门禁，避免把新的渲染契约、视图拆分或状态逻辑重新堆回单个超大文件。

## 技术方案对比与取舍

| 方案 | 描述 | 优点 | 风险/成本 | 结论 |
|---|---|---|---|---|
| A | 继续按文件类型逐个补映射与预览分支 | 交付快，短期可见 | 语言判定、预览与编辑继续漂移，后续回归成本持续升高 | 不采用 |
| B | 在补渲染的同时收敛共享渲染契约，并做最小必要重构 | 既能补现有缺口，又能控制后续扩展成本 | 需要先梳理边界与回归门禁 | **本次采用** |
| C | 直接重写整套文件查看模块与窗口状态模型 | 理论上最彻底 | 影响面过大，现有能力回归风险高 | 不采用 |

取舍：采用方案 B。先围绕“补渲染 + 统一契约 + 最小重构”推进，把缺失能力与结构债一起收口，但不做一次性大重写。

## Capabilities

### New Capabilities

- `file-view-rendering-runtime-stability`: 约束文件预览与编辑链路在主窗口和独立文件窗口中的渲染稳定性、回退语义与切换过程表现，覆盖空白渲染防护、模式切换一致性和安全 fallback。

### Modified Capabilities

- `file-view-language-rendering-coverage`: 扩展高频语言与配置文件的渲染覆盖，并补齐预览/编辑不对称场景下的统一判定与 fallback 要求。
- `independent-file-explorer-workspace`: 强化独立文件窗口对共享渲染契约的继承要求，确保其文件内容区与主窗口文件视图在渲染能力和稳定性上保持一致基线。
- `file-view-markdown-github-preview`: 补充 Markdown 文件预览在大文档、切换与降级场景中的稳定性要求，确保文件预览专用 renderer 在增强能力后仍保持独立边界。

## Impact

- 受影响前端模块：
  - `src/features/files/components/FileViewPanel.tsx`
  - `src/features/files/components/FileStructuredPreview.tsx`
  - `src/features/files/components/FileMarkdownPreview.tsx`
  - `src/features/files/components/FileExplorerWorkspace.tsx`
  - `src/features/files/components/DetachedFileExplorerWindow.tsx`
  - `src/features/files/detachedFileExplorer.ts`
  - `src/features/files/hooks/useDetachedFileExplorerState.ts`
  - `src/features/app/hooks/useGitPanelController.ts`
  - `src/features/files/utils/codemirrorLanguageExtensions.ts`
  - `src/utils/fileLanguageRegistry.ts`
  - `src/utils/syntax.ts`
- 受影响后端/接口边界：
  - 现有文件读取/写入与独立窗口外部变更感知命令继续复用，不预期新增破坏性 IPC 契约。
- 依赖与兼容性：
  - 优先复用现有 Prism / CodeMirror 能力，新增语言支持与结构化预览应以最小依赖增量为原则。
  - 配置文件编辑高亮优先复用仓库现有 lightweight CodeMirror / legacy mode（如 `properties`、`groovy`、`kotlin`），避免为了首期 comment-aware 能力引入新的重型依赖。
  - 必须覆盖 Windows 路径分隔符、Windows 文件名大小写语义与 macOS 绝对路径恢复场景下的一致渲染结果。
  - 前端重构需遵守仓库 `.github/workflows/large-file-governance.yml` 对 `npm run check:large-files:gate` 的硬门禁要求。
  - 必须保持现有文件打开、多标签、导航跳转、外部变更感知、Markdown 预览与独立文件窗口行为无回退。

## 验收标准

- 当前讨论中识别出的高频缺失或不完整文件类型，必须形成明确支持策略，并至少在预览/编辑/fallback 三者之一中表现为一致、可解释的结果。
- 首期冻结范围内的高频配置文件在编辑模式下，若存在仓库内可复用的轻量语法模式，则至少应具备注释高亮能力；例如 `.env/ini/conf` 的 `#` 注释与 `gradle/kts` 的 `//` 注释不应继续长期表现为无语法着色纯文本。
- 主窗口与独立文件窗口打开同类文本文件时，渲染结果不得出现系统性不对称或一侧退化为错误 fallback。
- 同一逻辑文件在 Windows 风格路径、Windows 大小写变体路径和 macOS 恢复出的绝对路径下，必须得到一致的语言判定、render kind 与 fallback 语义。
- 既有已支持文件类型的渲染行为不得因本次重构回退，尤其是 Markdown、Java/XML、Python、YAML/Properties、Shell、SQL、TOML 和图片预览。
- 对未知文件类型、超出覆盖范围的文本文件和不支持的二进制文件，系统必须安全退化，不得出现空白面板、未捕获异常或错误语言误判。
- 渲染链路重构后，文件切换、模式切换、tab 切换、独立窗口恢复和外部变更刷新场景必须保持稳定，不得破坏现有文件打开流程与独立文件窗口会话行为。
- 重构产物不得通过新增超大文件规避复杂度问题，最终实现必须通过仓库 large-file governance gate。
