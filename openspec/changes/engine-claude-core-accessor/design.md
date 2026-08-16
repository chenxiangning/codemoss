# Design

`fn core_claude(&self) -> &ClaudeSessionManager` 是唯一读字段的地方。构造仍写字段。其余方法的 flag-off 分支改调 `core_claude()`。源码断言 `self.claude_manager.` 只出现在 `core_claude`。
