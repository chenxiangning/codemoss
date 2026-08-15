# Proposal: plugin-ipc-uds-parent-0700

> Wave：1UDS6（插座本体 · UDS 父目录必须恰好 0700）  
> 依赖：1UDS3 0700 私有目录、1UDS5 无 /tmp 回落  
> 论文对齐：transport 是获取；可读父目录仍是共享上下文，不是独立上下文。

## Why

`parent_is_owner_only` 现在只禁 `mode & 0o022`。0755 父目录仍可通过 bind。组/他人可读意味着 socket 名可被枚举，不是 owner-only 独立上下文。

## 边界

1. `parent_is_owner_only` MUST 要求父目录 `mode == 0o700`。
2. 0755 / 0750 / 0770 父目录 MUST `permission-denied`。
3. `private_uds_dir` 仍 MUST 创建 0700。
4. 不切产品。

## Capabilities

- `plugin-ipc-uds-parent-0700-v1`
