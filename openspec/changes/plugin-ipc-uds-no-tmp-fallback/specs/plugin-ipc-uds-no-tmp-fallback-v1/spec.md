# plugin-ipc-uds-no-tmp-fallback-v1 Spec Delta

## ADDED Requirements

### Requirement: a failed private UDS path MUST NOT fall back to /tmp

`private_uds_path` 失败时，UDS driver / Worker / MXPD MUST 失败，且 MUST NOT 使用 `/tmp/mx-open.s`。

#### Scenario: source has no tmp fallback

- **WHEN** 检查 `uds_driver` / `quickjs` / `mxpd_uds` 源码
- **THEN** 它们 MUST NOT 包含 `/tmp/mx-open.s`
