# Design

Host 写 `host_to_plugin` 的 writer，对端读 reader；对端写 `plugin_to_host` 的 writer，Host 读 reader。两端都调用 `uds::{read,write}_mxpc_frame`。本刀不实现 `EntryDriver`。
