# Wave 1NP3 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-host-named-pipe-driver`  
> 结论：**方向正确。Named Pipe Host driver 非 Windows fail-closed；Everyone ACL / 非法名不得 start。** boot 仍用 UDS driver。Windows hello/ack 在 `cfg(windows)` 路径，本机 macOS 只验收失败面。不切产品。
