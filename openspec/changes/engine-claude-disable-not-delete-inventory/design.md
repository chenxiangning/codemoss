# Design

只写 inventory。Host fixture 的 disable 不是产品 disable。产品 Claude 仍走 `EngineManager` + `engine/claude*`。本刀不得把 `MOSSX_CLAUDE_COMPAT_FACADE` 默认打开，也不得在 boot 里 `host.disable(claude)`。
