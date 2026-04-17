## 1. 预览契约建模

- [x] 1.1 扩展 `fileRenderProfile`，为 `doc/docx/xls/xlsx/csv/pdf/png/jpg/jpeg` 建立显式 preview mode `[P0][依赖:无][输入: 现有 render profile 与文件类型矩阵][输出: 新 preview mode 类型与判定规则][验证: 单测覆盖九种文件类型及 Windows/macOS 路径样例]`
- [x] 1.2 为 preview mode 增加 source kind 约束，明确 `asset-url/file-handle/inline-bytes/extracted-structure` 边界 `[P0][依赖:1.1][输入: 当前 render profile、payload 设计][输出: PreviewSourceKind 设计与预算约束][验证: `pdf/xls/xlsx` 默认不走无界 bytes IPC]`
- [x] 1.3 调整 `fileViewSurface` 与 `FileViewBody` 的渲染入口，使视图层只消费 preview mode，不再直接猜扩展名 `[P0][依赖:1.1,1.2][输入: 当前 FileViewBody 分支逻辑][输出: preview mode 驱动的 viewer 路由][验证: 现有 Markdown / code / image 行为无回退]`
- [x] 1.4 冻结 Win/mac 兼容归一化策略 `[P0][依赖:1.1][输入: Windows 盘符/UNC 路径、大小写变体路径、macOS 恢复绝对路径、`convertFileSrc` 地址样例、CSV `CRLF/LF` 样例][输出: 统一 lookup key 和 payload 入口兼容规则][验证: 同一逻辑文件在 Win/mac 路径形态下得到一致 preview mode]`

## 2. Preview Payload 边界

- [x] 2.1 设计并实现受工作区约束的 preview payload 读取接口 `[P0][依赖:1.2][输入: workspace root、file path、preview mode][输出: 最小化的 preview payload command 或 service][验证: 非工作区路径被拒绝，阻塞读取不进入主 runtime，且大文件默认不走 inline bytes]`
- [x] 2.2 冻结 `docx` 与 `doc` 的能力边界：`docx` 走结构提取，`doc` 仅承诺 best-effort 或显式 fallback `[P0][依赖:2.1][输入: Word 文件样例][输出: Word 家族 payload 策略与失败语义][验证: `.doc` 不再被承诺为稳定富预览]`
- [x] 2.3 锁定 `pdf.js` worker 打包与 CSP/资源路径策略 `[P0][依赖:1.3][输入: Vite/Tauri 构建边界与 detached window 场景][输出: 可在 dev/prod 使用的 worker 加载方案][验证: 主窗口和 detached window 在生产构建下都能稳定加载 worker]`

## 3. Viewer 实现

- [x] 3.1 接入 `pdf-preview` viewer，并建立分页懒加载与失败 fallback `[P0][依赖:2.1,2.3][输入: PDF file-backed/asset payload][输出: PDF 预览组件][验证: 小 PDF 可读，大 PDF 不空白，失败时显示显式 fallback]`
- [x] 3.2 接入 `tabular-preview` viewer，统一支持 `csv/xls/xlsx` 的表格预览 `[P0][依赖:2.1][输入: 表格文件 file-backed 或文本 payload][输出: 表格预览组件与 sheet/row/col 截断策略][验证: csv/xls/xlsx 都能看到稳定表格结果，且 `xls/xlsx` 默认不经无界 bytes IPC]`
- [x] 3.3 将 `csv` 保持为“表格预览 + 原始文本编辑”双模式 `[P0][依赖:3.2][输入: CSV 打开与保存链路][输出: csv 预览/编辑切换行为][验证: 编辑保存后重新进入表格预览可见最新内容]`
- [x] 3.4 将 `png/jpg/jpeg` 纳入统一 preview matrix，并验证仍走现有 image preview 链路 `[P1][依赖:1.3][输入: 图片文件样例][输出: image-preview parity 验证结果][验证: 主窗口和 detached window 结果一致]`
- [x] 3.5 按 preview mode 拆分 viewer 组件与 payload hook，避免把复杂度堆回 `FileViewPanel` `[P0][依赖:1.3,2.1][输入: 现有 FileViewPanel 结构与 large-file 门禁要求][输出: 独立的 PDF / 表格 / 文档 viewer 与 payload hook 模块][验证: 新增实现结构可通过 `/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml` 对应的 `npm run check:large-files:gate`]`
- [x] 3.6 为 PDF/表格/文档 preview 建立统一 cleanup 契约 `[P0][依赖:3.1,3.2,3.5][输入: worker、object URL、临时句柄、异步解析任务][输出: viewer dispose/cancel 机制][验证: 切 tab、关文件、关 detached window 后不残留 worker、object URL 或旧请求回灌]`

## 4. 跨窗口与降级稳定性

- [x] 4.1 让主窗口与 detached file explorer 共享同一 preview mode 与 payload loader 入口 `[P0][依赖:3.1,3.2,3.4,3.6][输入: main / detached 打开链路][输出: 两个 surface 的统一预览入口][验证: 同一文件得到同一 preview mode，且资源释放语义一致]`
- [x] 4.2 为 `document-preview`、`tabular-preview`、`pdf-preview` 建立静态预算与截断提示 `[P0][依赖:3.1,3.2,2.2][输入: 大文档/大表格/大 PDF 样例][输出: 有界降级策略][验证: 不出现空白面板、卡死或未捕获异常]`

## 5. 回归验证

- [x] 5.1 补齐 preview mode 判定测试、payload 边界测试与 Windows/macOS 兼容测试 `[P0][依赖:4.2][输入: 各类型与路径形态样例][输出: 自动化测试集][验证: 九种文件类型全部有断言覆盖，且 `.doc` 仅断言 best-effort/fallback 语义，不断言稳定富预览]`
- [x] 5.2 补齐主窗口 / detached parity 测试和手测矩阵 `[P0][依赖:4.1][输入: main/detached surface 链路][输出: parity 回归用例与手测 checklist][验证: 两个 surface 对同一文件不出现 preview mode 漂移，也不出现资源清理分叉]`
- [x] 5.3 补齐 viewer 生命周期与请求取消测试 `[P0][依赖:3.6,4.1][输入: 切 tab、关文件、关 detached window 场景][输出: cleanup 回归用例][验证: worker/object URL/request 不残留，旧结果不会回灌新文件]`
- [x] 5.4 执行 large-file hard gate 并留痕 `[P0][依赖:3.5,5.1,5.2,5.3][输入: 完整改动后的文件查看实现][输出: `npm run check:large-files:gate` 结果与对应 CI 门禁说明][验证: 与 `/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml` 保持一致，未新增超大文件]`
