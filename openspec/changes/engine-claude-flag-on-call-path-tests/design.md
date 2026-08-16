# Design

只加单测。`OwnedClaudeHistory::uses_facade` 仅供测试核对调用路径。产品 `EngineManager::new()` 仍读 env，默认 off。不写产品启动链。
