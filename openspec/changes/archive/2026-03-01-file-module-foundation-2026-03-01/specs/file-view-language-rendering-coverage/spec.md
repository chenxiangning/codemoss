# file-view-language-rendering-coverage Specification

ADDED by change: file-module-foundation-2026-03-01

## Purpose

为右侧文件视图补齐 Java/Spring/Python 常见文件的预览与编辑渲染覆盖，并通过增量扩展方式保持现有已支持文件类型的渲染稳定性。

## ADDED Requirements

### Requirement: Unified Language Resolution Contract

系统 MUST 使用统一的文件语言判定规则为预览渲染与编辑渲染提供一致输入，不得由两套独立映射长期漂移。

#### Scenario: same file path resolves consistently for preview and edit pipelines

- **WHEN** 用户在右侧文件树打开任意可文本渲染文件
- **THEN** 系统 MUST 基于统一规则解析该文件的语言类型
- **AND** 预览链路与编辑链路 MUST 共享同一语言判定结果来源

#### Scenario: filename-priority rules are applied before extension fallback

- **WHEN** 打开具有强语义文件名的配置文件（例如 `pom.xml`、`application.properties`）
- **THEN** 系统 MUST 先应用文件名规则
- **AND** 文件名规则未命中时 MUST 回退到扩展名规则

### Requirement: Java and XML Files Render with Syntax Highlighting

系统 SHALL 为 Java 与 XML 文件在预览与编辑两种模式下提供语法高亮渲染。

#### Scenario: java source is highlighted in preview and edit modes

- **WHEN** 用户打开 `*.java` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 Java 语法高亮
- **AND** 编辑模式 MUST 显示 Java 语法高亮

#### Scenario: pom and other xml files are highlighted in preview and edit modes

- **WHEN** 用户打开 `pom.xml` 或任意 `*.xml` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 XML 语法高亮
- **AND** 编辑模式 MUST 显示 XML 语法高亮

### Requirement: Python Files Render with Syntax Highlighting

系统 SHALL 为 Python 文件在预览与编辑两种模式下提供语法高亮渲染。

#### Scenario: python source is highlighted in preview and edit modes

- **WHEN** 用户打开 `*.py` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 Python 语法高亮
- **AND** 编辑模式 MUST 显示 Python 语法高亮

### Requirement: Spring Configuration Files Render Correctly

系统 SHALL 为 Spring 常见配置文件提供可读且一致的语法渲染。

#### Scenario: spring properties files are highlighted in preview and edit modes

- **WHEN** 用户打开 `application.properties` 或任意 `*.properties` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 Properties 语法高亮
- **AND** 编辑模式 MUST 显示 Properties 语法高亮

#### Scenario: spring yaml files are highlighted in preview and edit modes

- **WHEN** 用户打开 `application.yml`、`application.yaml` 或 `application-*.yml` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 YAML 语法高亮
- **AND** 编辑模式 MUST 显示 YAML 语法高亮

### Requirement: SQL, GitIgnore, Lock and TOML Files Render Correctly

系统 SHALL 为 SQL、GitIgnore、Lock 与 TOML 文件提供可读且一致的语法渲染。

#### Scenario: sql files are highlighted in preview and edit modes

- **WHEN** 用户打开 `*.sql` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 SQL 语法高亮
- **AND** 编辑模式 MUST 显示 SQL 语法高亮

#### Scenario: gitignore files are highlighted in preview and edit modes

- **WHEN** 用户打开 `.gitignore` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示可读语法高亮
- **AND** 编辑模式 MUST 显示可读语法高亮

#### Scenario: lock files follow filename-priority language rules

- **WHEN** 用户打开 `*.lock` 文件并在预览/编辑模式间切换
- **THEN** 系统 MUST 先应用文件名优先规则（例如 `cargo.lock`）
- **AND** 文件名规则未命中时 MUST 回退到扩展名规则
- **AND** 预览与编辑模式 MUST 使用同一判定结果来源

#### Scenario: toml files are highlighted in preview and edit modes

- **WHEN** 用户打开 `*.toml` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 TOML 语法高亮
- **AND** 编辑模式 MUST 显示 TOML 语法高亮

### Requirement: Additive-Only Delivery and Non-Regression Guard

本变更 MUST 采用新增优先策略，既有已支持文件类型的渲染行为不得被破坏或回退。

#### Scenario: existing supported languages remain unchanged after rollout

- **WHEN** 变更后打开既有支持类型（如 `js`、`ts`、`json`、`md`、`css`、`yaml`）
- **THEN** 预览与编辑模式的渲染表现 MUST 与变更前基线一致
- **AND** 不得出现由本次扩展引入的高亮缺失或错误语言匹配

#### Scenario: unknown file types fall back safely to plain text

- **WHEN** 用户打开未被语言规则覆盖的文件类型
- **THEN** 系统 MUST 回退为纯文本渲染
- **AND** 回退过程 MUST 不触发崩溃、空白渲染或未捕获异常
