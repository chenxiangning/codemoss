# Embedding Model Directory

本地 ONNX 语义推理已从当前构建中移除（`ort` 无 `x86_64-apple-darwin` 预编译，阻断 Intel macOS 打包）。

记忆参考默认走 **关键词（lexical）** 检索。Tauri 命令 `project_memory_embed_*` 仍保留，health 固定返回：

- `status: unavailable`
- `downloadable: false`
- `reason: onnx_runtime_removed`

若日后恢复跨平台 embedding，再重新接入 runtime，并评估 Intel / Apple Silicon / Windows / Linux 打包矩阵。

可选开发资源（当前 **不会** 被打包或加载）：

```bash
bash scripts/download-embed-model.sh
```
