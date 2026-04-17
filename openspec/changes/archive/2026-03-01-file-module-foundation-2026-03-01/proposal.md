## Why

客户端右侧文件树已支持打开文件并进入文件视图，但文件渲染链路在“预览高亮（Prism）”与“编辑高亮（CodeMirror）”之间存在语言覆盖不一致，导致
Java/Spring/Python 常见文件出现“部分模式有高亮、部分模式无高亮”的断层体验。  
现在推进此提案，是为了补齐语言映射并建立统一渲染覆盖基线，让开发者在 Java/Spring 项目中获得稳定可读的文件视图。

## 目标与边界

- 目标：补齐 Java/Spring/Python 相关文件在右侧文件视图中的语法渲染覆盖，并追加 `.sql`、`.gitignore`、`.lock`、`.toml` 文件渲染。
- 目标：消除“同一文件在预览/编辑模式表现不一致”的高亮断层。
- 目标：建立文件扩展名到渲染语言的统一规则与回退策略。
- 目标：以新增方式补齐能力，不改变现有已支持文件类型的渲染结果。
- 目标：为关键语言覆盖增加可回归测试，避免后续映射回退。
- 边界：仅覆盖右侧文件视图渲染（预览与编辑）能力，不改变文件树交互行为。
- 边界：不改后端文件读取/写入协议，不引入存储结构变更。

## 非目标

- 不重构右侧文件树/Tab 状态管理。
- 不新增 IDE 级语义能力（LSP、跳转定义、重构）。
- 不覆盖所有编程语言，只聚焦本次明确提出的 Java/Spring/Python、SQL 与常见配置文件（含 `gitignore/lock/toml`）。

## What Changes

- 明确采用“新增优先（additive-only）”策略：在现有映射基础上扩展，不替换既有已验证规则。
- 补齐预览链路扩展名映射：至少覆盖 `py`、`xml`、`properties` 等 Spring/Java 常用文件类型。
- 补齐编辑链路语言扩展：为 `java`（及必要配置语言）提供 CodeMirror 对应语言扩展支持。
- 增强基于文件名模式的识别（例如 `pom.xml`、`application.properties`、`application-*.yml`、`.gitignore`、`cargo.lock`）。
- 补齐 SQL 与 TOML 渲染：支持 `.sql` 与 `.toml` 在预览/编辑两态高亮。
- 补齐锁文件渲染：支持 `.lock` 文件在预览/编辑两态按规则渲染（文件名优先、扩展名回退）。
- 统一预览与编辑的语言判定策略，避免同一文件两套规则不一致。
- 明确回退行为：未识别语言时保持纯文本渲染且不抛错。
- 增加回归测试：验证 Java、Spring 配置、Python 在预览/编辑两条链路下均达到预期渲染，并验证现有已支持类型无渲染回退。

## 技术方案对比

### 方案 A：继续分别维护两套映射（局部补洞）

- 优点：短期改动最小。
- 缺点：预览与编辑规则仍会漂移，后续语言扩展维护成本持续上升。
- 结论：不采纳。

### 方案 B：建立统一语言判定层并分别下发到 Prism/CodeMirror（推荐）

- 优点：规则单源、行为一致、可测试，后续新增语言只需扩展一处映射。
- 缺点：需要调整现有渲染代码结构并补充测试，改动范围中等。
- 结论：采纳。

取舍：选择方案 B，以中等改造换取可持续的语言渲染一致性。

## Capabilities

### New Capabilities

- `file-view-language-rendering-coverage`: 定义右侧文件视图中 Java/Spring/Python 文件及配置文件在预览/编辑模式下的统一渲染覆盖与回退规则。

### Modified Capabilities

- (none): 本提案聚焦新增渲染覆盖能力，不修改既有 capability requirement。

## 验收标准

1. `.java` 文件在预览与编辑两种模式下 MUST 都具备语法高亮。
2. `pom.xml`、`*.xml` Spring 配置在预览与编辑两种模式下 MUST 都具备 XML 高亮。
3. `.py` 文件在预览与编辑两种模式下 MUST 都具备 Python 高亮。
4. `application.properties` 等 `.properties` 配置文件在至少预览模式下 MUST 具备可读高亮，编辑模式 MUST 有明确可预期行为（高亮或受控回退）。
5. `application.yml` / `application.yaml` / `application-*.yml` 在预览与编辑模式下 MUST 保持 YAML 高亮。
6. `.sql` 文件在预览与编辑模式下 MUST 具备 SQL 高亮。
7. `.toml` 文件在预览与编辑模式下 MUST 具备 TOML 高亮。
8. `.gitignore` 文件在预览与编辑模式下 MUST 具备可读语法渲染。
9. `.lock` 文件在预览与编辑模式下 MUST 具备可读语法渲染，并遵循文件名优先规则。
10. 未识别扩展名文件 MUST 以纯文本渲染，且不得出现渲染异常或崩溃。
11. 覆盖上述类型的渲染测试 MUST 通过，且不破坏现有已支持语言表现。
12. 现有已支持类型（如 `js/ts/json/md/css/yaml`）在预览与编辑模式下的渲染行为 MUST 与变更前保持一致。

## Impact

- Affected code（预期）：
    - `src/features/files/components/FileViewPanel.tsx`
    - `src/features/files/components/FilePreviewPopover.tsx`
    - `src/features/files/components/FileTreePanel.tsx`
    - `src/utils/syntax.ts`
- API / Protocol：不引入破坏性外部协议变更。
- Dependencies：可能新增 CodeMirror 语言扩展依赖（如 Java/Properties 支持）。
- Systems：影响右侧文件视图渲染一致性与可读性。
