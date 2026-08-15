# Design

`Host::activate` 在占槽前用 HashSet 检查 required entry 去重后长度必须等于原长度。
