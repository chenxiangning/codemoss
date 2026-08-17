# engine-claude-process-entry-stdio-v1 Spec Delta

## ADDED Requirements

### Requirement: Process Entry MUST relay supervised CLI stdio over closed MXPC

supervise 成功后，Claude Process Entry MUST 把 CLI stdin/stdout 设为 pipe。Host MUST 只能通过 `mossx.process.stdio.write`、`mossx.process.stdio.read`、`mossx.process.stdio.close-stdin` 访问这些管道。`write` / `read` 的字节 MUST 以小写 `dataHex` 传递。无被监督子进程、非法 hex、未知 method MUST fail closed。本路径 MUST NOT 打开 MXPD，MUST NOT 替换产品 `cmd.spawn()`。

#### Scenario: echo stdout is readable after supervise

- **WHEN** Host supervise `/bin/echo`（或同等非 shell 可执行文件）并传入可见 argv
- **AND** Host 发送 `mossx.process.stdio.read`
- **THEN** 返回的 `dataHex` MUST 解码为该 argv 对应的输出

#### Scenario: cat round-trips stdin to stdout

- **WHEN** Host supervise `/bin/cat`
- **AND** 写入 `dataHex` 后 `close-stdin` 再 `read`
- **THEN** 读回的字节 MUST 与写入字节相同
