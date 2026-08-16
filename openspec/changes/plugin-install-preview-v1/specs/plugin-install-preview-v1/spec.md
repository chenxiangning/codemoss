# plugin-install-preview-v1 Spec Delta

## ADDED Requirements

### Requirement: install preview MUST NOT execute plugin code

安装预览 MUST 只消费 Manifest metadata。它 MUST NOT 读取 entry `path`、MUST NOT 读取 process binary、MUST NOT spawn。

#### Scenario: preview lists declared contributions without loading entries

- **WHEN** 对合法 Notes Manifest 调用 `previewInstall`
- **THEN** 预览 MUST 列出已声明 contribution 与 capability
- **AND** 预览模块 MUST NOT import `node:fs`

### Requirement: runtime registration MUST stay inside the Manifest envelope

注册请求 MUST 只能包含 Manifest 已声明的 contribution id 与 capability id。未声明项 MUST fail closed。

#### Scenario: undeclared contribution is rejected

- **WHEN** 注册 `notes.undeclared`
- **THEN** validator MUST 拒绝
- **AND** 不得把该项加入可见 contribution 集
