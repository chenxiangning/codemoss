# Proposal: plugin-host-composite-driver

> Wave：1H4（插座本体 · Host 按 Manifest kind 分发 Process / QuickJS）  
> 依赖：1F3 process catalog、1QJ4 worker catalog  
> 论文对齐：一个 unit 可含多条独立纤程；每条纤程走自己的获取 / 撤销。

## Why

Host 只能挂一个 `EntryDriver`。Claude 同时声明 `claude-cli`（process）和 `claude-worker`（quickjs）。单挂 spawn 就没有 isolate；单挂 QuickJS 就没有 child。合同要求一个 Activation Unit 按 kind 分发。

## 边界

1. `CompositeDriver` MUST 把 `kind=process` 交给 Restricted Process，把 `kind=worker` + `runtime=quickjs` 交给 QuickJS。
2. Claude 激活 MUST 同时留下 1 个 child 和 1 个 isolate。
3. Notes 激活 MUST 只留下 isolate，不得 spawn。
4. disable / Ready 再激活 MUST 两边一起撤销。
5. 不进 boot，不切产品。

## Capabilities

- `plugin-host-composite-driver-v1`
