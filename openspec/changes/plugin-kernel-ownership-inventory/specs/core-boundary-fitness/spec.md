# core-boundary-fitness Spec Delta

## ADDED Requirements

### Requirement: Retired owners MUST fail a boundary fitness check

系统 MUST 提供可执行的 Core Boundary fitness check。若 production frontend import 或 Native command registration 重新引入 `retired-unreferenced` owner，检查 MUST 以非零退出码失败。

#### Scenario: forged retired import fails the check

- **WHEN** fixture 让 AppShell 或等价 production 入口 import 一个 `retired-unreferenced` 模块
- **THEN** `scripts/check-core-shell-boundary.mjs` MUST exit nonzero

#### Scenario: current monolith still passes

- **WHEN** 当前工作树仍包含 `later-plugin` 与 `pilot` 实现
- **THEN** fitness check MUST exit 0
- **AND** 对 AppShell 直接 import `later-plugin` 内部文件 MAY 输出 soft warning，MUST NOT 因此失败

### Requirement: Fitness check MUST read the inventory rather than a stale hardcoded list

boundary check MUST 以 ownership inventory 为事实源，不得只维护一份与 inventory 漂移的硬编码路径表。

#### Scenario: inventory class change updates the check

- **WHEN** 某路径的 ownerClass 从 `later-plugin` 变为 `retired-unreferenced`
- **THEN** 同一 production import 在下次检查时 MUST 变为 hard failure
