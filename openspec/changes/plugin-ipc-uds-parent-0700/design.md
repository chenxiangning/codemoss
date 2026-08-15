# Design

`parent_is_owner_only` 从「无组/他人写」改成「恰好 0700」。测试在临时目录 chmod 0755 后 `bind_uds` 必须失败。
