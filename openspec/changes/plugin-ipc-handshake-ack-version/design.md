# Design

`validate_handshake_ack` 增加 `expected_version`。先核非空 SemVer 形，再核等于 Manifest version。driver 把当前 fixture version（V1 为 `1.0.0`）传进去。
