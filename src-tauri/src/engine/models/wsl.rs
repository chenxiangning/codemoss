//! WSL 发行版内的引擎模型目录:经 wsl_transport 远程跑
//! `<bin> models --json`(bin = 插件探针写进 meta 的发行版内绝对路径),
//! stdout 复用 pi::parse_models_json 解析。工作区不带 wsl meta 或探针
//! 没记录该引擎 bin 时返回空 catalog(前端回退 provider 配置)。

use super::{EngineCatalog, pi};

use crate::engine::wsl_transport::WslTransport;

pub(super) async fn pi_family_catalog_remote(
    engine: &str,
    transport: &WslTransport,
) -> EngineCatalog {
    let Some(bin) = transport.engine_paths.get(engine) else {
        return EngineCatalog::authoritative(Vec::new());
    };
    let bin = shell_safe_bin(bin);
    let script = format!("cd {cwd} 2>/dev/null; {bin} models --json", cwd = remote_cwd(transport));
    match crate::engine::wsl_transport::run_script_output(transport, &script).await {
        Ok(stdout) => match pi::parse_models_json(&stdout) {
            Ok(models) if !models.is_empty() => EngineCatalog::authoritative(models),
            _ => EngineCatalog::authoritative(Vec::new()),
        },
        Err(_) => EngineCatalog::authoritative(Vec::new()),
    }
}

fn remote_cwd(transport: &WslTransport) -> String {
    transport
        .workspace
        .clone()
        .unwrap_or_else(|| "~".to_string())
}

/// 探针写入的路径来自 `command -v` 输出(发行版内绝对路径),再过一遍
/// 白名单防御:仅 `[A-Za-z0-9_./~-]`,违例返回空串让命令失败而非注入。
fn shell_safe_bin(bin: &str) -> String {
    if bin.is_empty() || bin.chars().any(|c| !(c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '/' | '-' | '~'))) {
        return String::new();
    }
    bin.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bin_allowlist_rejects_injection() {
        assert_eq!(shell_safe_bin("/home/u/.local/bin/omp"), "/home/u/.local/bin/omp");
        assert_eq!(shell_safe_bin("/x; rm -rf /"), "");
        assert_eq!(shell_safe_bin("/a b/c"), "");
        assert_eq!(shell_safe_bin(""), "");
    }
}
