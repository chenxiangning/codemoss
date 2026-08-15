# Design

`validate_handshake_hello` 增加 `expected_nonce`。先核 64 hex，再核等于签发值。driver 接受端把 `issue_handshake_nonce()` 的结果传进去。
