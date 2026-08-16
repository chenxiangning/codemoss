# Design

`EngineManager` 不是 Clone，catalog delete 在 `tokio::spawn` 里。本刀给 `ClaudeCompatAdapter` 加 Clone，并提供 `owned_claude_history()`：flag on 克隆门面，flag off 走同一份磁盘 delete。catalog 只 clone handle，不再自己读 Claude config。
