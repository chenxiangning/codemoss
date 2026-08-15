# Design

`activate` 对 Ready 槽位递增 generation。若 DataPlane 仍挂着旧 generation stream，必须在 activate 后 revoke。若现实现未 revoke，本刀补 `activate` 后的 plane 清理。
