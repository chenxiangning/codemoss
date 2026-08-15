# Proposal: plugin-host-disable

> Wave：1B2（插座原语 · disable-not-delete）  
> 依赖：1B Host FSM、1D2 fuse deny、1E5 revoke

## Why

合同写明 disable 必须停槽、撤 handle、不得 resume。当前 Host 只有 fuse/reset。若不先在插座层证明 disable，后面产品 disable Claude 会和删代码缠在一起。

## 边界

1. `Host::disable` 停已启动 entry，slot=`disabled`。
2. disabled 后 activate MUST 失败，直到 reset。
3. Broker query MUST 失败。
4. `disable_and_revoke` 丢掉该 generation 的 MXPD。
5. **不删** `engine/claude*`，**不迁** `note_cards`。

## Capabilities

- `plugin-host-disable-v1`
