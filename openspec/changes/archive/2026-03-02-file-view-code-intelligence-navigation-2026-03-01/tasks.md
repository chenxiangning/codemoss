## 1. Contract and Capability Baseline

- [x] 1.1 调研并确认 OpenCode LSP definition/references 子命令可用性（输入：当前 CLI 能力；输出：命令契约与示例返回；验证：在
  Java 工程下可返回结构化结果；优先级：P0；依赖：无）
- [x] 1.2 定义前后端导航数据契约（输入：LSP 原始返回；输出：统一 location 数据结构；验证：TypeScript/Rust 类型一致；优先级：P0；依赖：1.1）

## 2. Backend LSP Command Extension

- [x] 2.1 在 `src-tauri/src/engine/commands.rs` 增加 `opencode_lsp_definition`（输入：workspace + fileUri +
  position；输出：definition locations；验证：命令可调用且错误可读；优先级：P0；依赖：1.2）
- [x] 2.2 在 `src-tauri/src/engine/commands.rs` 增加 `opencode_lsp_references`（输入：workspace + fileUri +
  position；输出：reference locations；验证：命令可调用且支持 includeDeclaration；优先级：P0；依赖：1.2）
- [x] 2.3 在 `src-tauri/src/lib.rs` 注册新命令并补充错误路径测试（输入：新增命令；输出：可由前端
  invoke；验证：编译通过且错误链路可触发；优先级：P0；依赖：2.1,2.2）

## 3. Frontend Service and Navigation API

- [x] 3.1 在 `src/services/tauri.ts` 新增 definition/references wrapper（输入：新 Tauri command；输出：强类型 service
  API；验证：单测覆盖成功/失败分支；优先级：P0；依赖：2.3）
- [x] 3.2 新增位置转换工具（CodeMirror offset <-> LSP line/character）（输入：编辑器状态；输出：标准化位置转换函数；验证：坐标转换单测通过；优先级：P0；依赖：3.1）

## 4. File Open Location Pipeline

- [x] 4.1 扩展 `handleOpenFile` 支持可选 location 参数（输入：path + location；输出：统一打开并定位行为；验证：打开已有 Tab
  也能定位；优先级：P0；依赖：3.2）
- [x] 4.2 在 `FileViewPanel` 接入定位滚动与光标设置（输入：location；输出：编辑器定位与聚焦；验证：跳转后视口与光标位置正确；优先级：P0；依赖：4.1）

## 5. Editor Code Intelligence Interaction

- [x] 5.1 在 `FileViewPanel` 增加 Ctrl/Cmd+Click definition 触发（输入：点击位置；输出：definition 查询与跳转；验证：Java
  方法/类名可跳转；优先级：P0；依赖：3.2,4.2）
- [x] 5.2 增加 Find References 入口（快捷键或上下文菜单）（输入：当前位置符号；输出：references
  列表；验证：可列出并点击跳转；优先级：P0；依赖：3.2,4.2）
- [x] 5.3 多目标候选选择 UI（输入：多 definition 结果；输出：候选弹层；验证：选择后定位正确；优先级：P1；依赖：5.1）

## 6. Reliability and Fallback

- [x] 6.1 LSP 不可用/无结果/报错状态处理（输入：失败场景；输出：明确 UI 提示与降级；验证：无崩溃且提示可理解；优先级：P0；依赖：5.1,5.2）
- [x] 6.2 请求并发治理与轻量缓存（输入：高频点击；输出：取消陈旧请求与防抖；验证：交互不卡顿且结果不串线；优先级：P1；依赖：5.1）

## 7. Tests and Verification

- [x] 7.1 前端单测：位置转换、服务包装、状态回退（验证：vitest 全通过；优先级：P0；依赖：3.2,6.1）
- [x] 7.2 组件测试：definition 单目标/多目标/references 列表（验证：关键交互断言通过；优先级：P0；依赖：5.1,5.2,5.3）
- [x] 7.3 端到端手工验收：Java 类名/方法调用跳转与引用（验证：验收记录完整；优先级：P0；依赖：全部）

## 8. Decouple From AI Engine (2026-03-01 scope update)

- [x] 8.1 新增独立 `code_intel_definition` / `code_intel_references` Tauri 命令（输入：workspace + filePath +
  position；输出：工程内 location 列表；验证：不依赖 opencode/codex engine；优先级：P0）
- [x] 8.2 `FileViewPanel` 从 `opencode_lsp_*` 切换到 `code_intel_*`（输入：编辑器光标/点击；输出：跳转定义与引用列表；验证：链路不经过
  AI 命令；优先级：P0）
- [x] 8.3 仅工程内扫描（Java 文件）并返回相对路径定位（输入：workspace root；输出：path + range；验证：跨文件跳转只在当前项目内；优先级：P0）
- [x] 8.4 扩展工程内导航语言覆盖（按优先级：Python -> TS/JS -> Go）（输入：源文件语言；输出：同语言 definition/references；验证：
  `code_intel` 命令多语言可返回结构化位置；优先级：P0）
- [x] 8.5 增加 Spring Boot YAML/YML 与 Java 配置关联（输入：YAML property key；输出：`@ConfigurationProperties` / `@Value` /
  `getProperty` 对应 Java 位置；验证：YAML 可跳转到 Java 类/字段/引用；优先级：P0）
