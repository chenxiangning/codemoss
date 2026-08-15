# Design

`CompositeDriver { process, worker }` 对每个 start/stop 先后调用两边。两边已按 Manifest catalog 自己 no-op，因此 Host 不用改签名。测试用 Claude / Notes fixture 验收分发，不进 `boot_host`。
