# Proposal: engine-claude-pilot-manifest

> OpenSpec change id: `engine-claude-pilot-manifest`  
> Wave：3B（第一根插头 · Contract 草稿）  
> 依赖：`engine-claude-pilot-inventory`、`plugin-manifest-v1-parser`  
> 架构：[`14` §10 / §17](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)、[`06` §4](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3A 已钉死 Claude 落点。若不先写 exact Engine Contribution，3C adapter 会发明字段。本刀只把 `com.mossx.engine.claude` 写成可被现有 `parseManifestV1` 接受的 Manifest，不接 Host、不双写、不删 Core。

## 目标与边界

1. 落下 `packages/plugin-contract/fixtures/valid/claude-engine.json`。
2. Worker + optional Process DAG；exact `mossx.engine.provider`；`engineId=claude`。
3. `onEngine` 激活；**禁止** `onStartup`。
4. Trusted React 不得出现在 Claude V1 Manifest（设置 UI 仍留 Core / 后续 slot）。
5. parser 单测必须通过；`src-tauri/src/engine/claude*` 零行为 diff。

## 非目标

- compatibility adapter / dual-run
- 独立仓库 / 打 `.mossx-plugin`
- 删除 Core Claude
- 其他 CLI Manifest

## Capabilities

### New Capabilities

- `engine-claude-manifest-v1`：Claude Engine exact contribution 与 DAG

## 验收标准

1. `pluginId` 为 `com.mossx.engine.claude`。
2. contributions 含 exact `mossx.engine.provider`，不含 template。
3. 无 `onStartup`、无 `trusted-react`。
4. `parseManifestV1` 在 `trustTier=system` 下成功。
5. 本 change 不修改 Claude 生产实现。
6. `openspec validate` 通过。
