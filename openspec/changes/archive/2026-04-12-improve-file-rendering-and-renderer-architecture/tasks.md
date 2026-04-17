## 1. 渲染契约收口

- [x] 1.1 盘点当前文件渲染决策入口并冻结目标支持矩阵 `[P0][依赖:无][输入: fileLanguageRegistry/syntax/codemirrorLanguageExtensions/FileStructuredPreview/FileViewPanel 现状][输出: 当前支持类型、首期 in-scope 类型（vue/php/rb/cs/dart/gradle/kts/ini/conf/.env/docker-compose.yml）、out-of-scope 清单、目标 render profile 字段清单、每种类型的 preview/edit/fallback frozen strategy][验证: 支持矩阵与 proposal/specs/design 一致，且不再把 svelte/astro/svg 等额外范围带入本 change]`
- [x] 1.2 设计并接入统一的 `FileRenderProfile` 解析层 `[P0][依赖:1.1][输入: 现有语言映射与 fallback 逻辑][输出: 统一 render profile 解析函数与类型定义][验证: preview/edit/structured/fallback 决策可由单一入口返回，新增单测覆盖不同文件类型与 Windows/macOS 路径形态]`
- [x] 1.3 将 `FileViewPanel` 切换到 render profile 驱动而不改变对外 props 语义 `[P0][依赖:1.2][输入: 现有 FileViewPanel props 与渲染分支][输出: 仍兼容现有调用方的 FileViewPanel orchestration 层][验证: 主窗口与 detached window 无需改调用协议即可通过 typecheck 和基础渲染测试]`

## 2. 语言覆盖与预览能力补齐

- [x] 2.1 补齐热门源码类型的预览语言映射与安全 fallback `[P0][依赖:1.2][输入: 热门缺失类型清单（如 vue/php/rb/cs/dart）][输出: 扩展后的 preview language 规则与对应测试样例][验证: 这些类型不再隐式退化为无语义纯文本，预览结果可解释且测试通过]`
- [x] 2.2 补齐热门配置文件的渲染策略 `[P0][依赖:1.2][输入: 配置文件清单（如 gradle/kts/ini/conf/.env/docker-compose.yml）][输出: 明确的 editor/preview/structured/fallback 策略及测试样例，并为可复用 lightweight mode 的配置文件补齐 comment-aware editor 基线][验证: 每种配置文件都有稳定结果，不再长期作为未定义处理，且 `.env/ini/conf` 的 `#` 与 `gradle/kts` 的 `//` 不再长期退化为无注释高亮纯文本]`
- [x] 2.3 收敛编辑器语言扩展策略，区分 `full/plain-text/read-only` 能力级别 `[P1][依赖:2.1,2.2][输入: 当前 CodeMirror 扩展支持范围与 render profile][输出: 编辑器能力分级与扩展加载策略；若仓库内已有 lightweight mode，则优先接入 comment-aware editor][验证: 已支持类型保持原能力，新增类型在编辑模式下行为明确且无空白/异常]`
- [x] 2.4 补齐 Windows/macOS 路径兼容用例 `[P0][依赖:1.2,2.1,2.2][输入: Windows 反斜杠路径、大小写变体文件名、macOS 绝对路径恢复样例][输出: 平台兼容路径测试样例与归一化规则][验证: 同一逻辑文件不会因路径分隔符、大小写或恢复路径形态不同得到不同 render kind]`

## 3. 主窗口与独立窗口渲染一致性

- [x] 3.1 收口主窗口渲染入口，只保留 render profile 驱动的单一决策链 `[P0][依赖:1.3,2.1][输入: useGitPanelController -> FileViewPanel 主链路][输出: 主窗口文件打开、切 tab、切模式、外部刷新时统一走 render profile / low-cost-preview / fallback 决策，并先在固定样例矩阵（`README.md`、`Dockerfile`、`docker-compose.yml`、`.env.local`、`build.gradle.kts`）上建立基线结果表][验证: 主窗口固定样例无 stale 内容、无错误 fallback、无空白面板，且 `.env.local` / `build.gradle.kts` 维持 comment-aware editor 基线]`
- [x] 3.2 为独立文件窗口建立与主窗口一致的渲染样例矩阵 `[P0][依赖:3.1][输入: DetachedFileExplorerWindow/useDetachedFileExplorerState/FileExplorerWorkspace 链路][输出: detached surface 与 main surface 在固定样例上的 render kind / editor capability / fallback parity 清单][验证: 同一文件在两个 surface 中得到一致的 render kind、fallback class、edit capability 与 comment-aware editor 行为]`
- [x] 3.3 加固 detached 会话恢复、绝对路径恢复与 tab 切换时的 renderer 状态对齐 `[P1][依赖:3.2][输入: detached session snapshot/event restore 流程][输出: 恢复后可直接渲染当前 active file 的稳定状态，并复用同一平台路径归一化规则][验证: detached 恢复、切 tab、切文件不泄漏上一文件的语言标记、预览内容或控制条状态，且 macOS 绝对路径恢复与 Windows 风格路径结果一致]`

## 4. Markdown 与运行时稳定性加固

- [x] 4.1 补强文件预览专用 Markdown renderer 在大文档和切换场景中的稳定性 `[P0][依赖:3.1][输入: FileMarkdownPreview 与 markdown file view 场景][输出: `README.md` 等 Markdown 文件在大文档、快速切 tab、preview/edit 切换、失败降级下稳定渲染][验证: 预览不会因切换或大文档进入空白状态，`truncated=true` 或超预算时稳定走 low-cost preview，且不会回退到 message renderer]`
- [x] 4.2 拆分 `FileViewPanel` 内部职责，抽离文档状态、渲染策略、外部同步和导航逻辑 `[P0][依赖:3.1][输入: 当前过载的 FileViewPanel 内部逻辑][输出: 至少拆出的 `document-state`、`render-body`、`external-sync`、`navigation` 子层，并保持 orchestration props 不变][验证: 组件复杂度下降，既有测试与新增测试可分别覆盖不同职责，且不产生新的 large-file governance 超限文件；若拆分失败可单独回退某个子层而不回退 render profile 契约]`
- [x] 4.3 为大文件和高成本预览增加有界降级策略 `[P1][依赖:4.1,4.2][输入: 大文本高亮、Markdown/structured preview 的高成本路径][输出: 基于 bytes/line-count/truncated 的静态阈值策略（code: 200KB/8000 行，markdown: 150KB/5000 行，structured: 120KB/3000 行）及触发条件][验证: 高成本文件不会无限阻塞主线程，仍能展示可读结果，且 Win/mac 不因机器性能差异进入不同降级分支]`
- [x] 4.4 避免渲染稳定性改造引入高频 IPC `[P1][依赖:3.1,3.2,4.3][输入: render state、external change、hover/scroll/drag 场景][输出: 前端本地化的 render-state 维护策略、允许/禁止 IPC 清单与审计证据][验证: 没有新增滚动/拖拽/hover 级别的 Tauri command 调用，renderer 选择不依赖高频 invoke，且 mode/surface 切换只使用前端本地状态完成]`

## 5. 回归验证与落地门禁

- [x] 5.1 为 render profile、语言覆盖和 fallback 行为补齐单元测试 `[P0][依赖:2.3,4.3][输入: 各类文件路径样例与预期渲染结果][输出: file language/render profile/fallback 测试集][验证: 热门新增类型、未知文本类型、二进制类型、边界输入均有自动化断言，且 frozen strategy matrix 中每种 in-scope 文件至少有一条 fixture 覆盖，并覆盖 bytes/line-count/truncated 三类降级边界]`
- [x] 5.2 为主窗口/独立窗口一致性补齐组件级回归测试 `[P0][依赖:3.3,4.2][输入: AppRouter、DetachedFileExplorerWindow、FileExplorerWorkspace、FileViewPanel 行为链路][输出: surface parity、切换稳定性与 session restore 测试][验证: 以 `README.md`、`Dockerfile`、`docker-compose.yml`、`.env.local`、`build.gradle.kts` 为固定样例时，打开同类文件、切 tab、切模式、恢复 session 的行为在测试中可复现并通过]`
- [x] 5.3 执行渲染域最终门禁验证 `[P0][依赖:5.1,5.2][输入: 完整改动后的前端渲染链路][输出: `pnpm typecheck`、相关 `vitest`、`npm run check:large-files:gate`、固定样例手测矩阵、IPC 审计结果][验证: typecheck / vitest / large-file governance 通过，且手测确认主窗口/独立窗口 parity、Markdown low-cost 降级、`.env/ini/conf` 注释高亮、`gradle/kts` 注释高亮、无新增高频 IPC 均无回退]`

## 6. 执行锁定

- 顺序锁定为：`3.1 -> 3.2 -> 3.3 -> 4.1 -> 4.2 -> 4.4 -> 5.2 -> 5.3`；未完成前一项，不进入后一项。
- 固定样例矩阵锁定为：`README.md`、`Dockerfile`、`docker-compose.yml`、`.env.local`、`build.gradle.kts`；如实现过程中新增样例，只能附加，不能替换这五个基准样例。
- 回滚必须保持在前端渲染层：允许单独回退主窗口 render-body、detached restore binding、Markdown dedicated branch 或某个拆出的 `FileViewPanel` 子层；禁止把已验证通过的 render profile 契约整体回滚掉。
- 最终门禁除了自动化命令，还必须包含“无新增高频 IPC”这一条显式结论；只看 UI 表面可用不算通过。
