# plugin-host-activation-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST activate an Activation Unit by required closure only

Host MUST 按 Manifest parser 给出的 required closure 拓扑启动 Entry。optional 边缺失 MUST NOT 失败。任一层 required 失败 MUST 反向停止已启动 Entry，slot 进入 `failed`，MUST NOT 留下半开 ready 状态。并发激活 MUST ≤ 2。`enabled=false` MUST 拒绝激活。

#### Scenario: required closure becomes ready

- **WHEN** FakeDriver 对 unit 内 required entries 全部回报 ready
- **THEN** slot state MUST 为 `ready`

#### Scenario: required timeout rolls back

- **WHEN** 某个 required Entry 超过 activation deadline
- **THEN** 已启动 Entry MUST 被 stop
- **AND** slot state MUST 为 `failed`
