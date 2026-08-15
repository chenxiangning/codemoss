# Design

`rquickjs` 编译捆绑 QuickJS C。每个 isolate 一条专用线程：线程内 `Runtime::new` + `Context::full`，只挂 `mossx.handshake.hello` / `mossx.sdk.ready`。Host 侧 `EngineHandle` 用 channel 发 eval / shutdown，保持 `BootHost: Send`。allowlist 仍是第一闸门；`mossx.handshake.hello(` 这种过闸门但非法的源码必须被引擎拒绝。
