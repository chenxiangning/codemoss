# Design

测试里先后 activate Claude / Notes fixture，各自 open stream。Claude 调 `storage.access_file` 指向 Notes 必须失败。disable Notes 后 Claude codec 仍在。
