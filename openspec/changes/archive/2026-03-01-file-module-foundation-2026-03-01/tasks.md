## 1. Baseline and Dependency Setup

- [x] 1.1 固化“新增不破坏”基线清单（输入：现有已支持类型 `js/ts/json/md/css/yaml`
  渲染表现；输出：基线用例列表与断言清单；验证：评审通过且后续测试引用该清单；优先级：P0；依赖：无）
- [x] 1.2 增加所需语言依赖与导入（输入：Java/Properties 渲染缺口；输出：`package.json`
  与渲染模块依赖更新；验证：安装后可编译且无缺失模块错误；优先级：P0；依赖：1.1）

## 2. Unified Language Resolution

- [x] 2.1 新增统一语言注册表模块（输入：当前分散的预览/编辑映射；输出：单一语言判定
  API，支持文件名优先与扩展名回退；验证：静态检查通过且可被预览/编辑共同调用；优先级：P0；依赖：1.2）
- [x] 2.2 预览链路接入统一注册表（输入：`syntax.ts` 与 Prism 高亮调用；输出：`py/xml/properties`
  预览高亮补齐并统一走注册表；验证：关键文件在预览模式高亮正确；优先级：P0；依赖：2.1）
- [x] 2.3 编辑链路接入统一注册表（输入：`FileViewPanel` 的 `cmLangExtension()`；输出：`java/properties`
  编辑高亮补齐并统一走注册表；验证：关键文件在编辑模式高亮正确；优先级：P0；依赖：2.1）

## 3. Spring and JVM Coverage Rules

- [x] 3.1 实现 Spring 文件名规则优先（输入：`pom.xml`、`application.properties`、`application-*.yml`
  ；输出：文件名匹配优先于扩展名匹配；验证：命名样例均命中预期语言；优先级：P1；依赖：2.1）
- [x] 3.2 完善未知类型安全回退（输入：未覆盖扩展名文件；输出：纯文本回退且无异常抛出；验证：未知文件打开无崩溃且渲染可读；优先级：P1；依赖：2.2,2.3）

## 4. Tests and Non-Regression Guard

- [x] 4.1 增加语言判定矩阵单测（输入：Java/Spring/Python 与存量类型样例路径；输出：注册表判定单测；验证：新增用例全部通过；优先级：P0；依赖：2.1,3.1）
- [x] 4.2 增加文件视图渲染组件测试（输入：预览/编辑两模式渲染链路；输出：`.java/.xml/.py/.properties/.yml`
  渲染断言；验证：组件测试通过；优先级：P0；依赖：2.2,2.3,3.2）
- [x] 4.3 增加存量类型防回退测试（输入：基线清单；输出：`js/ts/json/md/css/yaml` 一致性断言；验证：变更前后表现一致；优先级：P0；依赖：1.1,4.1）

## 5. Verification and Delivery

- [x] 5.1 执行质量门禁（输入：完整代码改动；输出：`typecheck` + 目标测试结果；验证：零 type 错误且测试通过；优先级：P0；依赖：4.1,4.2,4.3）
- [x] 5.2 完成手工验收与变更记录（输入：关键样例文件清单；输出：验收记录与结果说明；验证：
  `java/xml/python/properties/yaml/sql/toml/gitignore/lock` 双模式通过且无存量回归；优先级：P1；依赖：5.1）

## 6. 验收记录

- [x] 6.1 自动化验收：`npm run typecheck` 通过，零 TypeScript 错误。
- [x] 6.2 自动化验收：
  `npx vitest run src/utils/fileLanguageRegistry.test.ts src/utils/syntax.test.ts src/features/files/utils/codemirrorLanguageExtensions.test.ts src/features/files/components/FilePreviewPopover.test.tsx`
  通过（4 files, 13 tests）。

## 7. Proposal Append - SQL/GitIgnore/Lock/TOML

- [x] 7.1 追加提案范围（`.sql/.gitignore/.lock/.toml`）并同步到 proposal/design/spec（输入：用户追加需求；输出：三份 artifacts
  范围对齐；验证：OpenSpec 校验通过；优先级：P0；依赖：无）
- [x] 7.2 扩展统一语言注册表与渲染链路（输入：新增文件类型；输出：预览/编辑双链路支持；验证：目标测试与 typecheck
  通过；优先级：P0；依赖：7.1）
