# Design

`compile_pipe_sddl(owner, allow)`：`pipe_acl_ok` + SID 形态 + allow 恰好 `[owner]`，产出 `O:{sid}G:{sid}D:P(A;;GA;;;{sid})`。`sddl_ok` 拒绝 world ACE。Windows `bind` 调 `ConvertStringSecurityDescriptorToSecurityDescriptorW`。
