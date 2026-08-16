# Design

source facts 保留 related / workspace-only 两条独立入口。门面只换调用路径，不合并两种 scan。`EngineManager` 读 Claude config 后经 `claude_owner()`。projection 仍负责 attribution_mode 分支和 cache dir。
