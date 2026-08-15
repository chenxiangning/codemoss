# Design

复用 `uds::{read,write}_mxpc_frame`。`bind_named_pipe`：

- 先过 `pipe_name_ok`
- Windows：`CreateNamedPipeW` + `FILE_FLAG_FIRST_PIPE_INSTANCE`，默认 DACL（当前用户）
- 非 Windows：`unsupported-platform`

ACL 收紧到 Host pid 留给 1NP2。
