# plugin-host-ready-requires-heartbeat-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST NOT publish Ready without one successful heartbeat

Host 在全部 required entries `start` 成功后 MUST 再对每个 entry 做一次 `heartbeat`。任一次失败 MUST LIFO stop 已 start 的 entries，槽位 MUST Failed，MUST NOT Ready。MUST NOT 切产品。

#### Scenario: a missing first heartbeat cannot become Ready

- **WHEN** required entries 都 start 成功
- **AND** 其中一个 entry 的第一次 heartbeat 失败
- **THEN** activate MUST `activation-failed`
- **AND** 槽位 MUST Failed
- **AND** 已 start 的 entries MUST 被 LIFO stop
