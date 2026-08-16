# Design

catalog 给每个包一个稳定本地 hash。stage 时若 lockfile 已有不同 hash，拒绝。
