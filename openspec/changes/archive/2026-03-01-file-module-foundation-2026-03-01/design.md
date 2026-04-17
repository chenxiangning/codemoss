## Context

右侧文件视图当前存在两条独立渲染链路：

- 预览模式：`src/utils/syntax.ts` 的 `languageFromPath()` + Prism `highlightLine()`
- 编辑模式：`src/features/files/components/FileViewPanel.tsx` 的 `cmLangExtension()` + CodeMirror extension

两条链路各自维护语言映射，已经出现覆盖不一致：

- `.py`：编辑模式有 `python()`，预览模式缺少扩展名映射
- `.xml`（包括 `pom.xml`）：编辑模式有 `xml()`，预览模式缺少扩展名映射
- `.java`：预览模式有 Prism `java`，编辑模式无 `java` CodeMirror extension
- `.properties`（Spring 常见）：两条链路都缺少明确支持
- `.sql`：预览与编辑都缺少明确支持
- `.toml`：预览模式可高亮，编辑模式缺少明确支持
- `.gitignore`：无扩展名，缺少文件名级语言规则
- `.lock`：缺少统一渲染策略，不同生态锁文件表现不一致

这会导致同一文件在“预览/编辑”切换时高亮行为跳变，直接影响 Java/Spring 项目使用体验。

约束：

- 仅改前端渲染，不改 Tauri 文件读写与后端协议
- 未识别语言必须稳定回退到纯文本，禁止渲染异常
- 不引入大型编辑器重构，保持当前 FileViewPanel 架构

## Goals / Non-Goals

**Goals:**

- 建立统一的文件语言判定规则，避免两套映射漂移
- 补齐 Java/Spring/Python 常见文件在预览与编辑中的渲染覆盖，并追加 SQL/gitignore/lock/toml 文件渲染
- 明确文件名与扩展名混合判定（如 `pom.xml`、`application.properties`）
- 严格保持现有已支持文件类型渲染行为不变（additive-only）
- 增加覆盖矩阵测试，确保后续迭代不回退

**Non-Goals:**

- 不引入 LSP、语义分析、跳转定义等 IDE 级能力
- 不覆盖所有语言生态，本次仅覆盖 Java/Spring/Python 相关优先集
- 不改文件树交互行为（打开/关闭/切换逻辑）

## Decisions

### Decision 1: 引入统一语言注册表，替代分散映射（采纳）

- 方案 A：继续在 `syntax.ts` 与 `FileViewPanel.tsx` 各自维护映射
- 方案 B（采纳）：抽出统一 `file language registry`，预览和编辑都从同一规则取语言

取舍：

- 方案 A 改动小，但会持续出现“改一处漏一处”
- 方案 B 初次改动稍大，但能根治映射漂移，后续扩展成本最低

设计要点：

- 按“文件名规则优先、扩展名规则次之、默认纯文本”判定
- 统一输出 `{ previewLanguage, editorLanguage, fallback }` 语义

### Decision 2: 定义本次最小但完整的 Spring/Java/Python/SQL/Config 覆盖矩阵（采纳）

- 方案 A：只修用户当前反馈的 `.java` 和 `.py`
- 方案 B（采纳）：一次补齐 `java/xml/properties/yaml/python/sql/toml` 及常见命名规则（含 `.gitignore`、`.lock`）

覆盖目标：

- Java：`*.java`
- XML：`*.xml`（包括 `pom.xml`、`logback-spring.xml`）
- Python：`*.py`
- Spring 配置：`*.properties`、`application*.yml`、`application*.yaml`
- SQL：`*.sql`
- Config/Lock：`*.toml`、`.gitignore`、`*.lock`（文件名优先）

取舍：

- 方案 A 交付更快但会继续出现“修完一个又暴露一个”的体验
- 方案 B 可一次建立稳定基线，更符合本次提案目标

### Decision 3: 编辑高亮引入 Java/Properties 对应 CodeMirror 支持（采纳）

- 方案 A：编辑态继续对 `java/properties` 走纯文本
- 方案 B（采纳）：为 Java 和 Properties 增加 CodeMirror 语言扩展

依赖策略：

- Java：新增 `@codemirror/lang-java`
- Properties：使用 `@codemirror/legacy-modes` + `StreamLanguage`（或等效可维护方案）

取舍：

- 方案 A 会保留“预览有高亮、编辑无高亮”断层
- 方案 B 增加少量依赖，但一致性收益明显

### Decision 4: 预览高亮补全 Prism 语言与映射（采纳）

- 方案 A：仅补扩展名映射，不补语言包
- 方案 B（采纳）：同时补齐映射与必要 Prism language 组件（如 properties、sql、git）

取舍：

- 仅补映射会产生“映射命中但语言包不存在”的静默降级
- 映射 + 语言包同步补齐才能确保预览链路稳定生效

### Decision 8: lock 文件采用“文件名优先 + 扩展名回退”策略（采纳）

- 方案 A（采纳）：对 `cargo.lock` 等已知文件名做优先规则；其余 `*.lock` 走通用扩展名回退规则
- 方案 B：统一把所有 `*.lock` 绑定到同一种语言

取舍：

- 方案 B 简单但误判概率高，容易牺牲不同生态锁文件可读性
- 方案 A 在复杂度可控前提下更准确，且满足增量扩展原则

### Decision 5: 渲染失败采用显式回退而非抛错（采纳）

- 方案 A：严格依赖语言扩展，异常时抛错
- 方案 B（采纳）：统一回退纯文本，并保留可追踪日志

取舍：

- 文件渲染属于核心阅读链路，稳定性优先于激进失败策略

### Decision 6: 测试前置到语言判定层 + 关键路径组件层（采纳）

- 方案 A：只做手工验证
- 方案 B（采纳）：增加自动化测试覆盖语言矩阵与回退行为

最小测试集：

- 单元：语言判定（路径 -> 预览/编辑语言）矩阵测试
- 组件：FileViewPanel 在关键类型文件下是否加载预期扩展
- 回退：未知扩展名渲染不崩溃且为纯文本
- 防回退：现有支持语言（如 `js/ts/json/md/css/yaml`）渲染结果一致性断言

### Decision 7: 本次变更执行“新增优先，不破坏存量”规则（采纳）

- 方案 A（采纳）：在原有映射上做增量扩展，禁止替换或重定义既有稳定映射行为
- 方案 B：借机重排全部映射规则

取舍：

- 方案 B 风险过高，容易引入无关回归；与本次目标不匹配
- 方案 A 可控性更高，能保证“修缺口而不破坏存量”

## Risks / Trade-offs

- [Risk] 新增 CodeMirror 语言依赖可能增加包体积  
  → Mitigation: 仅引入必须语言；评估按需加载可能性并记录 bundle 变化

- [Risk] `properties` 的 legacy mode 高亮精度不如专用 parser  
  → Mitigation: 先满足可读性目标；后续根据反馈再升级 parser 方案

- [Risk] 统一映射重构可能影响既有已支持语言  
  → Mitigation: 对现有支持语言建立基线快照与回归测试

- [Risk] 实现阶段为追求统一而误改现有映射优先级  
  → Mitigation: 变更审查时强制执行 additive-only 检查项，禁止无需求的行为变更

- [Risk] 文件名规则优先可能引发边界误判  
  → Mitigation: 规则顺序固定、可测试，并记录冲突样例

- [Risk] `*.lock` 通用回退规则对部分生态语法贴合度有限  
  → Mitigation: 先保证可读与稳定，后续按高频文件名逐步细化规则

## Migration Plan

1. 代码准备

- 新增/补齐语言依赖（Java、Properties 所需）
- 引入统一语言注册表模块

2. 渲染链路接入

- 预览链路改为读取统一注册表语言
- 编辑链路改为读取统一注册表 extension

3. 验证与回归

- 增加语言矩阵单测与关键组件测试
- 手工验证 `java/xml/properties/yaml/python/sql/toml/gitignore/lock` 文件在预览/编辑两态表现

4. 发布与回滚

- 本变更无数据迁移，可直接发布
- 如出现异常，可回滚到旧映射实现（撤销注册表接入与新增语言依赖）

## Open Questions

- `*.gradle` / `*.kts` 是否纳入下一批 JVM 生态补齐范围？
- `properties` 编辑高亮是否需要支持 Spring 占位符（`${...}`）的增强着色？
- 是否要把同一语言注册表复用到 Git Diff Viewer，确保全局渲染一致性？
