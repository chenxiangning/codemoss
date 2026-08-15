# Design

复用 `claude_activation_request` + `PluginRuntime`。断言 disable 后三类 handle 全失败，并用 `Path::exists` 证明 `src/engine/claude.rs`。
