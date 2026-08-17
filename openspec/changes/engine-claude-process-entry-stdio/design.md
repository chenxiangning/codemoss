# Design

Control 面冻结为三条 MXPC（仍走 Process Entry stdin/stdout，不走 MXPD）：

```json
{"jsonrpc":"2.0","id":"io-1","method":"mossx.process.stdio.write","params":{"dataHex":"6869"}}
{"jsonrpc":"2.0","id":"io-2","method":"mossx.process.stdio.read","params":{}}
{"jsonrpc":"2.0","id":"io-3","method":"mossx.process.stdio.close-stdin","params":{}}
```

`dataHex` 是小写 hex，避免 naive JSON 解析撞上转义。`read` 非阻塞：无数据回空串；管道对端关闭回 `eof=true`。

`RestrictedProcessDriver` 在 handshake + supervise 之后，用同一条 MXPC 发这三条。产品 `ClaudeSession::send_message` 仍 `cmd.spawn()`；flag-on 仍 `process-entry-spawn-not-cutover`。
