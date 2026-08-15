# Design

`eval` 先确认 isolate 存活，再 `allow_mossx_bridge`：trim 后必须以 `mossx.handshake.` 或 `mossx.sdk.` 开头，且不得夹带 `require` / `import` / `eval(`。
