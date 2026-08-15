# Design

`RestrictedProcessDriver` 持有 `data_root`。spawn 时算 `plugin_data_cwd`，闸门通过后 `current_dir`。peer fixture 若 `cwd != MOSSX_PLUGIN_DATA` 则退出 4。
