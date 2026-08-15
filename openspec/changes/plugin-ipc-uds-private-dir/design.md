# Design

`private_uds_dir()` 在 `/tmp/m{pid}` 建 0700 目录。`bind_uds` 检查 parent mode `& 0o022 == 0` 且不是 `/tmp`。`uds_driver` / `mxpd_uds` / 测试统一走该 helper。路径仍保持短于 `SUN_LEN`。
