# Design

`private_uds_dir(plugin_id)` 用 pluginId 最后一段作短 token，建 `/tmp/m{pid}/{token}`（0700）。`private_uds_path(plugin_id, tag)` 落在该目录。非法 pluginId 失败。driver / Worker / MXPD 传入当前 pluginId。
