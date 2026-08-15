# Design

`CapabilityBroker::query` 已走 `Host::dispatch`。fuse 把 slot 置 `Fused`，dispatch 非 Ready 即失败。本刀补 fused 场景单测，不改生产路径。
