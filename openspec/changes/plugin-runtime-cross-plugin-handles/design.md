# Design

`Host::dispatch(plugin_id, generation)` 已校验该 slot 的 generation。若 Claude generation 碰巧等于 Notes，这条会成功——那是合同洞。本刀先写测试：若两边 generation 相同，跨插件 query 仍必须失败。若现实现会过，则在 Broker / open_stream 补 caller 绑定。

当前 dispatch 只看目标 slot，没有 caller。跨插件「用对方 generation」在 generation 相等时会误放行。本刀把 generation 比较改成：dispatch 仍按目标 slot；测试用「Claude generation 去打 Notes」。若相等则必须另加 caller。更干净的合同：generation 只对目标 plugin 有效，相等也合法——因为 generation 不是跨插件密钥。

重新定边界：真正的洞是「Notes 打开的 stream 被 Claude 的 plugin_id 复用」。`open_stream(plugin_id, generation, stream_id)` 已把 stream 记到 plugin_id。跨插件攻击应是：Claude 用自己的 generation 打开一个 Notes 已占用的 stream_id，或 Claude query Notes。query Notes 需要 Notes 自己的 generation。若 generation 都是 1，Claude 用 1 query Notes 会成功——这是设计：generation 不是身份，plugin_id 才是。

真正该锁的是：Claude 不得 `query_read("com.mossx.notes", claude_gen)` 当且仅当 `claude_gen != notes_gen`。这太弱。

改成：stream 不得被另一 plugin 的 open 覆盖；以及 Claude 不得 access Notes store（2L 已有）。跨 plugin query 本身是 Host 允许的——Core 用 plugin_id 指名查询。

更有价值的刀：`open_stream` 时若 stream_id 已被另一 plugin 占用，MUST `stream-exists`（已有）且不得改 plugin_id。1AC 已覆盖同 plugin。跨 plugin 占用同一 stream_id：DataPlane 全局 HashMap，第二次必 `stream-exists`。补组合面：Claude 不得占用 Notes 已开的 stream_id。
