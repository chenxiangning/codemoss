# engine-claude-process-entry-wait-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST reap supervised CLI exit status without always interrupting

`mossx.process.wait` MUST 非阻塞试收割已 supervise 的 CLI。已退出 MUST 返回 `exited=true` 与退出码。未退出 MUST 返回 `exited=false`。`send_message` 在 flag-on 且非 grace 时 MUST 先 wait；仅当仍未退出才 interrupt。默认路径 MUST 仍调用 `child.wait()`。

#### Scenario: true exits zero

- **WHEN** Process Entry 已 supervise `/bin/true` 并 close-stdin
- **THEN** wait MUST 在短时间内返回 `exited=true` 且 `code=0`

#### Scenario: false exits non-zero

- **WHEN** Process Entry 已 supervise `/bin/false` 并 close-stdin
- **THEN** wait MUST 返回非零 code
