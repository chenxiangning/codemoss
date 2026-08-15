# Design

`DataPlane::open` 在插入前统计同 plugin + generation 的已开 stream。默认上限 8。组合面 `open_stream` 走同一条路。
