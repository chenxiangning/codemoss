# Design

`reset_plugin` 先读当前 generation，再 `host.reset`，再 `plane.revoke`。
