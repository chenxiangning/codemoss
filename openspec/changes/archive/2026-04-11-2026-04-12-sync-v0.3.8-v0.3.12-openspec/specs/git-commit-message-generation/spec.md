## ADDED Requirements

### Requirement: AI Commit Message Generation MUST Support Language Selection

系统 MUST 支持按语言生成提交信息（`zh` / `en`），并保持 Conventional Commits 约束。

#### Scenario: selecting Chinese generates zh commit message prompt

- **WHEN** 用户选择中文生成
- **THEN** 系统 MUST 以中文 Conventional Commits 提示词发起生成
- **AND** 生成结果 SHOULD 包含标题与正文

#### Scenario: selecting English generates en commit message prompt

- **WHEN** 用户选择英文生成
- **THEN** 系统 MUST 以英文 Conventional Commits 提示词发起生成
- **AND** 生成结果 SHOULD 保持英文语义

### Requirement: AI Commit Message Generation MUST Support Engine Selection

系统 MUST 支持按引擎触发提交信息生成（Codex / Claude / Gemini / OpenCode）。

#### Scenario: codex engine uses codex background generation path

- **WHEN** 用户选择 `codex` 作为生成引擎
- **THEN** 系统 MUST 调用 codex 提交信息生成链路
- **AND** 不得额外引入并行 prompt 发送路径

#### Scenario: non-codex engines use prompt + sync message path

- **WHEN** 用户选择 `claude/gemini/opencode`
- **THEN** 系统 MUST 先获取 commit prompt
- **AND** MUST 通过对应引擎同步消息通道生成结果

### Requirement: Generated Commit Message MUST Be Sanitized Before Applying To Input

系统 MUST 在写回 commit 输入框前清洗 AI 输出，避免解释性文本污染提交内容。

#### Scenario: fenced or prefixed response is normalized to conventional title/body

- **WHEN** AI 返回包含代码块、列表前缀或解释性文本
- **THEN** 系统 MUST 提取并规范化 Conventional Commit 标题
- **AND** SHOULD 保留有效正文内容

#### Scenario: stale async result MUST NOT overwrite another workspace input

- **WHEN** 生成请求返回时用户已切换到其他 workspace
- **THEN** 系统 MUST 丢弃该结果
- **AND** 当前 workspace 输入内容 MUST 不被覆盖
