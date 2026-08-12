use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::ErrorKind;
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::time::timeout;

use crate::backend::app_server::{
    build_codex_path_env, build_command_for_binary, check_cli_binary, find_claude_code_binary,
    find_cli_binary,
};
use crate::types::AppSettings;

const INSTALL_TIMEOUT_SECS: u64 = 180;
const PREFLIGHT_TIMEOUT_SECS: u64 = 8;
const OUTPUT_SUMMARY_LIMIT: usize = 4_000;
const PROGRESS_CHUNK_LIMIT: usize = 1_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CliInstallEngine {
    Codex,
    Claude,
    Kimi,
    Grok,
    #[serde(rename = "opencode")]
    OpenCode,
    Pi,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CliInstallAction {
    InstallLatest,
    UpdateLatest,
    Uninstall,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CliInstallStrategy {
    NpmGlobal,
    CliSelfUpdate,
    /// Claude Code official native installer (`install.sh` / `install.ps1`) and native file uninstall.
    OfficialNative,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CliInstallBackend {
    Local,
    Remote,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum CliInstallPlatform {
    Macos,
    Windows,
    Linux,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CliInstallPlan {
    pub(crate) engine: CliInstallEngine,
    pub(crate) action: CliInstallAction,
    pub(crate) strategy: CliInstallStrategy,
    pub(crate) backend: CliInstallBackend,
    pub(crate) platform: CliInstallPlatform,
    pub(crate) command_preview: Vec<String>,
    pub(crate) can_run: bool,
    pub(crate) blockers: Vec<String>,
    pub(crate) warnings: Vec<String>,
    pub(crate) manual_fallback: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CliInstallResult {
    pub(crate) ok: bool,
    pub(crate) engine: CliInstallEngine,
    pub(crate) action: CliInstallAction,
    pub(crate) strategy: CliInstallStrategy,
    pub(crate) backend: CliInstallBackend,
    pub(crate) exit_code: Option<i32>,
    pub(crate) stdout_summary: Option<String>,
    pub(crate) stderr_summary: Option<String>,
    pub(crate) details: Option<String>,
    pub(crate) duration_ms: u128,
    pub(crate) doctor_result: Option<Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CliInstallProgressPhase {
    Started,
    Stdout,
    Stderr,
    Finished,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CliInstallOutputStream {
    Stdout,
    Stderr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CliInstallProgressEvent {
    pub(crate) run_id: String,
    pub(crate) engine: CliInstallEngine,
    pub(crate) action: CliInstallAction,
    pub(crate) strategy: CliInstallStrategy,
    pub(crate) backend: CliInstallBackend,
    pub(crate) phase: CliInstallProgressPhase,
    pub(crate) stream: Option<CliInstallOutputStream>,
    pub(crate) message: Option<String>,
    pub(crate) exit_code: Option<i32>,
    pub(crate) duration_ms: Option<u128>,
}

#[derive(Debug, Clone)]
struct InstallerCommandSpec {
    program: String,
    args: Vec<String>,
    path_env: Option<String>,
}

/// Resolve the strategy actually used for an engine/action.
/// Claude Code install/update both use the official native installer; Codex / Kimi / OpenCode stay on npm global.
/// Grok CLI install/update both use the official curl installer (no npm distribution, no uninstall).
pub(crate) fn resolve_effective_strategy(
    engine: CliInstallEngine,
    action: CliInstallAction,
    requested: CliInstallStrategy,
) -> CliInstallStrategy {
    match engine {
        CliInstallEngine::Claude | CliInstallEngine::Grok => CliInstallStrategy::OfficialNative,
        CliInstallEngine::Codex | CliInstallEngine::Kimi | CliInstallEngine::OpenCode | CliInstallEngine::Pi => {
            match requested {
                CliInstallStrategy::NpmGlobal => CliInstallStrategy::NpmGlobal,
                // Codex/Kimi/OpenCode self-update stays blocked; keep requested so plan can explain.
                other => other,
            }
        }
    }
}

pub(crate) type CliInstallProgressSink = Arc<dyn Fn(CliInstallProgressEvent) + Send + Sync>;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CliVersionStatus {
    pub(crate) engine: CliInstallEngine,
    pub(crate) installed: bool,
    pub(crate) local_version: Option<String>,
    pub(crate) latest_version: Option<String>,
    pub(crate) update_available: bool,
    pub(crate) node_ok: bool,
    pub(crate) details: Option<String>,
}

pub(crate) fn package_name_for_engine(engine: CliInstallEngine) -> &'static str {
    match engine {
        CliInstallEngine::Codex => "@openai/codex@latest",
        CliInstallEngine::Claude => "@anthropic-ai/claude-code@latest",
        CliInstallEngine::Kimi => "@moonshot-ai/kimi-code@latest",
        CliInstallEngine::OpenCode => "opencode-ai@latest",
        CliInstallEngine::Pi => "@earendil-works/pi-coding-agent@latest",
        // Grok CLI is not distributed via npm; it uses the official curl installer.
        CliInstallEngine::Grok => unreachable!("grok is not distributed via npm"),
    }
}

fn uninstall_package_name_for_engine(engine: CliInstallEngine) -> &'static str {
    match engine {
        CliInstallEngine::Codex => "@openai/codex",
        CliInstallEngine::Claude => "@anthropic-ai/claude-code",
        CliInstallEngine::Kimi => "@moonshot-ai/kimi-code",
        CliInstallEngine::Pi => "@earendil-works/pi-coding-agent",
        // Grok CLI is not distributed via npm; it uses the official curl installer.
        CliInstallEngine::Grok => unreachable!("grok is not distributed via npm"),
        // OpenCode uninstall is intentionally not supported (protects auth and session data).
        CliInstallEngine::OpenCode => {
            unreachable!("opencode uninstall is intentionally not supported")
        }
    }
}

pub(crate) fn registry_package_name_for_engine(engine: CliInstallEngine) -> &'static str {
    match engine {
        // OpenCode has no uninstall name but is probed on the npm registry.
        CliInstallEngine::OpenCode => "opencode-ai",
        other => uninstall_package_name_for_engine(other),
    }
}

fn claude_native_install_preview() -> Vec<String> {
    if cfg!(target_os = "windows") {
        vec![
            "powershell".to_string(),
            "-NoProfile".to_string(),
            "-ExecutionPolicy".to_string(),
            "Bypass".to_string(),
            "-Command".to_string(),
            "irm https://claude.ai/install.ps1 | iex".to_string(),
        ]
    } else {
        vec![
            "bash".to_string(),
            "-lc".to_string(),
            "curl -fsSL https://claude.ai/install.sh | bash".to_string(),
        ]
    }
}

fn claude_native_uninstall_shell_unix() -> &'static str {
    r#"rm -f "$HOME/.local/bin/claude" && rm -rf "$HOME/.local/share/claude"; if command -v npm >/dev/null 2>&1; then npm uninstall -g @anthropic-ai/claude-code 2>/dev/null || true; fi"#
}

fn claude_native_uninstall_shell_windows() -> &'static str {
    r#"Remove-Item -Path "$env:USERPROFILE\.local\bin\claude.exe" -Force -ErrorAction SilentlyContinue; Remove-Item -Path "$env:USERPROFILE\.local\share\claude" -Recurse -Force -ErrorAction SilentlyContinue; if (Get-Command npm -ErrorAction SilentlyContinue) { npm uninstall -g @anthropic-ai/claude-code 2>$null | Out-Null }"#
}

fn claude_native_uninstall_preview() -> Vec<String> {
    if cfg!(target_os = "windows") {
        vec![
            "powershell".to_string(),
            "-NoProfile".to_string(),
            "-ExecutionPolicy".to_string(),
            "Bypass".to_string(),
            "-Command".to_string(),
            claude_native_uninstall_shell_windows().to_string(),
        ]
    } else {
        vec![
            "bash".to_string(),
            "-lc".to_string(),
            claude_native_uninstall_shell_unix().to_string(),
        ]
    }
}

fn grok_native_install_preview() -> Vec<String> {
    // Grok CLI ships only the official bash installer (no npm package, no
    // PowerShell variant); Windows plans are blocked in plan build.
    vec![
        "bash".to_string(),
        "-lc".to_string(),
        "curl -fsSL https://x.ai/cli/install.sh | bash".to_string(),
    ]
}

fn command_preview_for(engine: CliInstallEngine, action: CliInstallAction) -> Vec<String> {
    match engine {
        CliInstallEngine::Claude => match action {
            CliInstallAction::InstallLatest | CliInstallAction::UpdateLatest => {
                claude_native_install_preview()
            }
            CliInstallAction::Uninstall => claude_native_uninstall_preview(),
        },
        CliInstallEngine::Grok => match action {
            CliInstallAction::InstallLatest | CliInstallAction::UpdateLatest => {
                grok_native_install_preview()
            }
            CliInstallAction::Uninstall => vec![
                "echo".to_string(),
                "Grok CLI uninstall is intentionally not supported (protects ~/.grok auth and sessions)."
                    .to_string(),
            ],
        },
        CliInstallEngine::Codex | CliInstallEngine::Kimi | CliInstallEngine::Pi => match action {
            CliInstallAction::InstallLatest | CliInstallAction::UpdateLatest => vec![
                "npm".to_string(),
                "install".to_string(),
                "-g".to_string(),
                package_name_for_engine(engine).to_string(),
            ],
            CliInstallAction::Uninstall => vec![
                "npm".to_string(),
                "uninstall".to_string(),
                "-g".to_string(),
                uninstall_package_name_for_engine(engine).to_string(),
            ],
        },
        CliInstallEngine::OpenCode => match action {
            CliInstallAction::InstallLatest | CliInstallAction::UpdateLatest => vec![
                "npm".to_string(),
                "install".to_string(),
                "-g".to_string(),
                package_name_for_engine(engine).to_string(),
            ],
            CliInstallAction::Uninstall => vec![
                "echo".to_string(),
                "OpenCode CLI uninstall is intentionally not supported (protects opencode auth and sessions)."
                    .to_string(),
            ],
        },
    }
}

fn current_platform() -> CliInstallPlatform {
    if cfg!(target_os = "macos") {
        CliInstallPlatform::Macos
    } else if cfg!(target_os = "windows") {
        CliInstallPlatform::Windows
    } else if cfg!(target_os = "linux") {
        CliInstallPlatform::Linux
    } else {
        CliInstallPlatform::Unknown
    }
}

fn manual_fallback_for(engine: CliInstallEngine, action: CliInstallAction) -> String {
    command_preview_for(engine, action).join(" ")
}

fn engine_binary_name(engine: CliInstallEngine) -> &'static str {
    match engine {
        CliInstallEngine::Codex => "codex",
        CliInstallEngine::Claude => "claude",
        CliInstallEngine::Kimi => "kimi",
        CliInstallEngine::Grok => "grok",
        CliInstallEngine::OpenCode => "opencode",
        CliInstallEngine::Pi => "pi",
    }
}

fn engine_explicit_bin<'a>(engine: CliInstallEngine, settings: &'a AppSettings) -> Option<&'a str> {
    match engine {
        CliInstallEngine::Codex => settings.codex_bin.as_deref(),
        CliInstallEngine::Claude => settings.claude_bin.as_deref(),
        CliInstallEngine::Kimi => settings.kimi_bin.as_deref(),
        CliInstallEngine::Grok => settings.grok_bin.as_deref(),
        CliInstallEngine::OpenCode => settings.opencode_bin.as_deref(),
        CliInstallEngine::Pi => settings.pi_bin.as_deref(),
    }
    .filter(|value| !value.trim().is_empty())
}

async fn run_binary_version(
    binary: &str,
    path_env: Option<&String>,
) -> Result<Option<String>, String> {
    let binary_path = Path::new(binary);
    let resolved_binary = if binary_path.is_absolute() || binary_path.exists() {
        binary.to_string()
    } else {
        find_cli_binary(binary, None)
            .map(|path| path.to_string_lossy().to_string())
            .unwrap_or_else(|| binary.to_string())
    };
    let mut command = build_command_for_binary(&resolved_binary);
    if let Some(path_env) = path_env {
        command.env("PATH", path_env);
    }
    command.arg("--version");
    command.stdout(std::process::Stdio::piped());
    command.stderr(std::process::Stdio::piped());

    match timeout(
        Duration::from_secs(PREFLIGHT_TIMEOUT_SECS),
        command.output(),
    )
    .await
    {
        Ok(Ok(output)) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(if version.is_empty() {
                None
            } else {
                Some(version)
            })
        }
        Ok(Ok(output)) => {
            // Claude Code also accepts `-v`; retry once for absolute binaries.
            let mut fallback = build_command_for_binary(&resolved_binary);
            if let Some(path_env) = path_env {
                fallback.env("PATH", path_env);
            }
            fallback.arg("-v");
            fallback.stdout(std::process::Stdio::piped());
            fallback.stderr(std::process::Stdio::piped());
            match timeout(
                Duration::from_secs(PREFLIGHT_TIMEOUT_SECS),
                fallback.output(),
            )
            .await
            {
                Ok(Ok(fallback_output)) if fallback_output.status.success() => {
                    let version = String::from_utf8_lossy(&fallback_output.stdout)
                        .trim()
                        .to_string();
                    Ok(if version.is_empty() {
                        None
                    } else {
                        Some(version)
                    })
                }
                _ => {
                    let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
                    Err(if detail.is_empty() {
                        format!("{binary} failed to start")
                    } else {
                        detail
                    })
                }
            }
        }
        Ok(Err(error)) if error.kind() == ErrorKind::NotFound => Err("not_found".to_string()),
        Ok(Err(error)) => Err(error.to_string()),
        Err(_) => Err(format!("{binary} check timed out")),
    }
}

fn is_windows_wsl_boundary_path(path: &str) -> bool {
    let trimmed = path.trim();
    let lower = trimmed.to_ascii_lowercase();
    lower.starts_with("\\\\wsl$\\")
        || lower.starts_with("\\\\wsl.localhost\\")
        || lower.starts_with("//wsl$/")
        || lower.starts_with("//wsl.localhost/")
}

async fn resolve_npm_prefix(path_env: Option<&String>) -> Result<Option<String>, String> {
    let npm_binary = find_cli_binary("npm", None)
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_else(|| "npm".to_string());
    let mut command = build_command_for_binary(&npm_binary);
    if let Some(path_env) = path_env {
        command.env("PATH", path_env);
    }
    command.arg("config");
    command.arg("get");
    command.arg("prefix");
    command.stdout(std::process::Stdio::piped());
    command.stderr(std::process::Stdio::piped());

    match timeout(
        Duration::from_secs(PREFLIGHT_TIMEOUT_SECS),
        command.output(),
    )
    .await
    {
        Ok(Ok(output)) if output.status.success() => {
            let prefix = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(if prefix.is_empty() || prefix == "undefined" {
                None
            } else {
                Some(prefix)
            })
        }
        Ok(Ok(output)) => {
            let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Err(if detail.is_empty() {
                "failed to resolve npm global prefix".to_string()
            } else {
                detail
            })
        }
        Ok(Err(error)) => Err(error.to_string()),
        Err(_) => Err("npm prefix check timed out".to_string()),
    }
}

async fn npm_prefix_blocker(path_env: Option<&String>) -> Option<String> {
    let Ok(Some(prefix)) = resolve_npm_prefix(path_env).await else {
        return None;
    };
    let prefix_path = Path::new(&prefix);
    let Ok(metadata) = std::fs::metadata(prefix_path) else {
        return None;
    };
    if metadata.permissions().readonly() {
        Some(format!(
            "npm global prefix appears read-only: {prefix}. The installer will not use sudo or admin elevation."
        ))
    } else {
        None
    }
}

async fn resolve_installer_command(
    engine: CliInstallEngine,
    action: CliInstallAction,
    settings: &AppSettings,
) -> Result<InstallerCommandSpec, String> {
    let path_env = build_codex_path_env(engine_explicit_bin(engine, settings));
    let strategy = resolve_effective_strategy(engine, action, CliInstallStrategy::NpmGlobal);

    match (engine, strategy, action) {
        (
            CliInstallEngine::Claude,
            CliInstallStrategy::OfficialNative,
            CliInstallAction::InstallLatest | CliInstallAction::UpdateLatest,
        ) => {
            if cfg!(target_os = "windows") {
                let program = find_cli_binary("powershell", None)
                    .map(|path| path.to_string_lossy().to_string())
                    .unwrap_or_else(|| "powershell".to_string());
                Ok(InstallerCommandSpec {
                    program,
                    args: vec![
                        "-NoProfile".to_string(),
                        "-ExecutionPolicy".to_string(),
                        "Bypass".to_string(),
                        "-Command".to_string(),
                        "irm https://claude.ai/install.ps1 | iex".to_string(),
                    ],
                    path_env,
                })
            } else {
                Ok(InstallerCommandSpec {
                    program: "/bin/bash".to_string(),
                    args: vec![
                        "-lc".to_string(),
                        "curl -fsSL https://claude.ai/install.sh | bash".to_string(),
                    ],
                    path_env,
                })
            }
        }
        (
            CliInstallEngine::Claude,
            CliInstallStrategy::OfficialNative,
            CliInstallAction::Uninstall,
        ) => {
            if cfg!(target_os = "windows") {
                let program = find_cli_binary("powershell", None)
                    .map(|path| path.to_string_lossy().to_string())
                    .unwrap_or_else(|| "powershell".to_string());
                Ok(InstallerCommandSpec {
                    program,
                    args: vec![
                        "-NoProfile".to_string(),
                        "-ExecutionPolicy".to_string(),
                        "Bypass".to_string(),
                        "-Command".to_string(),
                        claude_native_uninstall_shell_windows().to_string(),
                    ],
                    path_env,
                })
            } else {
                Ok(InstallerCommandSpec {
                    program: "/bin/bash".to_string(),
                    args: vec![
                        "-lc".to_string(),
                        claude_native_uninstall_shell_unix().to_string(),
                    ],
                    path_env,
                })
            }
        }
        (
            CliInstallEngine::Grok,
            CliInstallStrategy::OfficialNative,
            CliInstallAction::InstallLatest | CliInstallAction::UpdateLatest,
        ) => {
            if cfg!(target_os = "windows") {
                Err(
                    "Grok CLI installer requires a Unix shell (bash); on Windows run it inside WSL."
                        .to_string(),
                )
            } else {
                Ok(InstallerCommandSpec {
                    program: "/bin/bash".to_string(),
                    args: vec![
                        "-lc".to_string(),
                        "curl -fsSL https://x.ai/cli/install.sh | bash".to_string(),
                    ],
                    path_env,
                })
            }
        }
        (
            CliInstallEngine::Grok,
            CliInstallStrategy::OfficialNative,
            CliInstallAction::Uninstall,
        ) => Err(
            "Grok CLI uninstall is intentionally not supported (protects ~/.grok auth and sessions)."
                .to_string(),
        ),
        (
            CliInstallEngine::OpenCode,
            CliInstallStrategy::NpmGlobal,
            CliInstallAction::InstallLatest | CliInstallAction::UpdateLatest,
        ) => {
            let npm_path = find_cli_binary("npm", None)
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_else(|| "npm".to_string());
            Ok(InstallerCommandSpec {
                program: npm_path,
                args: vec![
                    "install".to_string(),
                    "-g".to_string(),
                    package_name_for_engine(engine).to_string(),
                ],
                path_env,
            })
        }
        (
            CliInstallEngine::OpenCode,
            CliInstallStrategy::NpmGlobal,
            CliInstallAction::Uninstall,
        ) => Err(
            "OpenCode CLI uninstall is intentionally not supported (protects opencode auth and sessions)."
                .to_string(),
        ),
        (
            CliInstallEngine::Codex | CliInstallEngine::Kimi,
            CliInstallStrategy::NpmGlobal,
            _,
        ) => {
            let npm_path = find_cli_binary("npm", None)
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_else(|| "npm".to_string());
            let args = match action {
                CliInstallAction::InstallLatest | CliInstallAction::UpdateLatest => vec![
                    "install".to_string(),
                    "-g".to_string(),
                    package_name_for_engine(engine).to_string(),
                ],
                CliInstallAction::Uninstall => vec![
                    "uninstall".to_string(),
                    "-g".to_string(),
                    uninstall_package_name_for_engine(engine).to_string(),
                ],
            };
            Ok(InstallerCommandSpec {
                program: npm_path,
                args,
                path_env,
            })
        }
        _ => Err(format!(
            "unsupported installer combination: engine={engine:?} action={action:?} strategy={strategy:?}"
        )),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Ord, PartialOrd)]
struct SemVerParts {
    major: u64,
    minor: u64,
    patch: u64,
}

pub(crate) fn extract_semver(raw: &str) -> Option<SemVerParts> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let bytes = trimmed.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index].is_ascii_digit() {
            let start = index;
            while index < bytes.len() && bytes[index].is_ascii_digit() {
                index += 1;
            }
            if index < bytes.len() && bytes[index] == b'.' {
                let major_str = &trimmed[start..index];
                index += 1;
                let minor_start = index;
                while index < bytes.len() && bytes[index].is_ascii_digit() {
                    index += 1;
                }
                if index < bytes.len() && bytes[index] == b'.' && minor_start < index {
                    let minor_str = &trimmed[minor_start..index];
                    index += 1;
                    let patch_start = index;
                    while index < bytes.len() && bytes[index].is_ascii_digit() {
                        index += 1;
                    }
                    if patch_start < index {
                        let patch_str = &trimmed[patch_start..index];
                        if let (Ok(major), Ok(minor), Ok(patch)) = (
                            major_str.parse::<u64>(),
                            minor_str.parse::<u64>(),
                            patch_str.parse::<u64>(),
                        ) {
                            return Some(SemVerParts {
                                major,
                                minor,
                                patch,
                            });
                        }
                    }
                }
            }
        } else {
            index += 1;
        }
    }
    None
}

pub(crate) fn is_update_available(local: &str, latest: &str) -> bool {
    match (extract_semver(local), extract_semver(latest)) {
        (Some(local_parts), Some(latest_parts)) => latest_parts > local_parts,
        _ => false,
    }
}

async fn run_npm_view_version(package: &str, path_env: Option<&String>) -> Result<String, String> {
    let npm_binary = find_cli_binary("npm", None)
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_else(|| "npm".to_string());
    let mut command = build_command_for_binary(&npm_binary);
    if let Some(path_env) = path_env {
        command.env("PATH", path_env);
    }
    command.arg("view");
    command.arg(package);
    command.arg("version");
    command.stdout(std::process::Stdio::piped());
    command.stderr(std::process::Stdio::piped());

    match timeout(
        Duration::from_secs(PREFLIGHT_TIMEOUT_SECS),
        command.output(),
    )
    .await
    {
        Ok(Ok(output)) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if version.is_empty() {
                Err("npm view returned empty version".to_string())
            } else {
                Ok(version)
            }
        }
        Ok(Ok(output)) => {
            let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Err(if detail.is_empty() {
                format!("npm view {package} failed")
            } else {
                detail
            })
        }
        Ok(Err(error)) if error.kind() == ErrorKind::NotFound => {
            Err("npm is not available".to_string())
        }
        Ok(Err(error)) => Err(error.to_string()),
        Err(_) => Err(format!("npm view {package} timed out")),
    }
}

fn pick_claude_version_line(output: &str) -> Option<String> {
    let lines: Vec<&str> = output
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect();
    // Prefer the line that looks like Claude Code version output.
    if let Some(line) = lines
        .iter()
        .rev()
        .find(|line| line.to_ascii_lowercase().contains("claude") && extract_semver(line).is_some())
    {
        return Some((*line).to_string());
    }
    lines
        .iter()
        .rev()
        .find(|line| {
            let version_token = line
                .trim_start_matches(|character| character == 'v' || character == 'V')
                .split_whitespace()
                .next()
                .unwrap_or_default()
                .split(|character| character == '-' || character == '+')
                .next()
                .unwrap_or_default();
            let mut parts = version_token.split('.');
            matches!(
                (parts.next(), parts.next(), parts.next(), parts.next()),
                (Some(major), Some(minor), Some(patch), None)
                    if !major.is_empty()
                        && !minor.is_empty()
                        && !patch.is_empty()
                        && major.bytes().all(|byte| byte.is_ascii_digit())
                        && minor.bytes().all(|byte| byte.is_ascii_digit())
                        && patch.bytes().all(|byte| byte.is_ascii_digit())
            )
        })
        .map(|line| (*line).to_string())
}

/// Match Terminal exactly: interactive login shell runs `claude -v`.
async fn run_claude_version_via_interactive_shell() -> Option<(String, String)> {
    #[cfg(windows)]
    {
        return None;
    }

    #[cfg(not(windows))]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        let mut command = crate::utils::async_command(&shell);
        command.arg("-lic");
        command.arg("command -v claude && claude -v");
        command.stdin(std::process::Stdio::null());
        command.stdout(std::process::Stdio::piped());
        command.stderr(std::process::Stdio::piped());

        let output = timeout(
            Duration::from_secs(PREFLIGHT_TIMEOUT_SECS),
            command.output(),
        )
        .await
        .ok()?
        .ok()?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        let combined = format!("{stdout}\n{stderr}");
        let mut path: Option<String> = None;
        let mut version: Option<String> = None;
        for line in combined
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
        {
            let candidate = Path::new(line);
            if path.is_none() && candidate.is_absolute() && candidate.exists() {
                path = Some(line.to_string());
                continue;
            }
            if version.is_none() {
                if let Some(picked) = pick_claude_version_line(line) {
                    if extract_semver(&picked).is_some()
                        || picked.to_ascii_lowercase().contains("claude")
                    {
                        version = Some(picked);
                    }
                }
            }
        }
        let version = version.or_else(|| pick_claude_version_line(&combined))?;
        let path = path.unwrap_or_else(|| "claude (shell)".to_string());
        Some((version, path))
    }
}

async fn resolve_claude_local_version(
    settings: &AppSettings,
    path_env: Option<&String>,
) -> (Option<String>, Option<String>) {
    // 1) Exact Terminal match — ignore GUI PATH / stale claudeBin for version display.
    if let Some((version, path)) = run_claude_version_via_interactive_shell().await {
        return (
            Some(version),
            Some(format!("resolved via interactive shell: {path}")),
        );
    }

    // 2) Fall back to configured / discovered Claude Code binary.
    let binary = find_claude_code_binary(engine_explicit_bin(CliInstallEngine::Claude, settings))
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_else(|| "claude".to_string());
    match run_binary_version(&binary, path_env).await {
        Ok(Some(raw)) => {
            let version = pick_claude_version_line(&raw);
            (
                version,
                Some(format!("resolved binary version output: {binary}")),
            )
        }
        Ok(None) => (
            None,
            Some(format!("resolved binary had empty version: {binary}")),
        ),
        Err(error) => (None, Some(format!("failed to probe {binary}: {error}"))),
    }
}

pub(crate) async fn resolve_cli_version_status(
    engine: CliInstallEngine,
    settings: &AppSettings,
) -> CliVersionStatus {
    let path_env = build_codex_path_env(engine_explicit_bin(engine, settings));
    let node_available = run_binary_version("node", path_env.as_ref()).await.is_ok();
    let npm_available = run_binary_version("npm", path_env.as_ref()).await.is_ok();
    let registry_ok = node_available && npm_available;
    // `node_ok` gates lifecycle mutation buttons in the UI.
    // Claude native install does not require Node/npm; Codex/Kimi/OpenCode still do.
    // Grok uses the official bash installer, so it needs a supported Unix platform.
    let node_ok = match engine {
        CliInstallEngine::Claude => !matches!(current_platform(), CliInstallPlatform::Unknown),
        CliInstallEngine::Grok => !matches!(
            current_platform(),
            CliInstallPlatform::Unknown | CliInstallPlatform::Windows
        ),
        CliInstallEngine::Codex | CliInstallEngine::Kimi | CliInstallEngine::OpenCode | CliInstallEngine::Pi => {
            registry_ok
        }
    };

    let mut details: Option<String> = None;
    let local_version = match engine {
        CliInstallEngine::Claude => {
            let (version, resolve_details) =
                resolve_claude_local_version(settings, path_env.as_ref()).await;
            details = resolve_details;
            version
        }
        CliInstallEngine::Codex
        | CliInstallEngine::Kimi
        | CliInstallEngine::Grok
        | CliInstallEngine::OpenCode
        | CliInstallEngine::Pi => {
            match check_cli_binary(engine_binary_name(engine), path_env.clone()).await {
                Ok(Some(version)) => Some(version),
                Ok(None) => None,
                Err(_) => None,
            }
        }
    };
    let installed = local_version.is_some();

    let latest_version = if engine == CliInstallEngine::Grok {
        // Grok CLI is not on npm; there is no registry version probe.
        details = Some(match details {
            Some(existing) => {
                format!("{existing}; Grok CLI has no npm registry probe; latest version unknown.")
            }
            None => "Grok CLI has no npm registry probe; latest version unknown.".to_string(),
        });
        None
    } else if registry_ok {
        match run_npm_view_version(registry_package_name_for_engine(engine), path_env.as_ref())
            .await
        {
            Ok(version) => Some(version),
            Err(error) => {
                details = Some(match details {
                    Some(existing) => format!("{existing}; {error}"),
                    None => error,
                });
                None
            }
        }
    } else {
        details = Some(match details {
            Some(existing) => {
                format!("{existing}; Node/npm is not available for registry version probe.")
            }
            None => "Node/npm is not available for registry version probe.".to_string(),
        });
        None
    };

    let update_available = match (&local_version, &latest_version) {
        (Some(local), Some(latest)) => is_update_available(local, latest),
        _ => false,
    };

    CliVersionStatus {
        engine,
        installed,
        local_version,
        latest_version,
        update_available,
        node_ok,
        details,
    }
}

pub(crate) async fn build_cli_install_plan_with_backend(
    engine: CliInstallEngine,
    action: CliInstallAction,
    requested_strategy: CliInstallStrategy,
    backend: CliInstallBackend,
    settings: &AppSettings,
) -> CliInstallPlan {
    let strategy = resolve_effective_strategy(engine, action, requested_strategy);
    let mut blockers = Vec::new();
    let mut warnings = Vec::new();
    let platform = current_platform();

    if matches!(platform, CliInstallPlatform::Unknown) {
        blockers.push("Unsupported platform for one-click installer.".to_string());
    }

    let path_env = build_codex_path_env(engine_explicit_bin(engine, settings));
    if cfg!(target_os = "windows") {
        if let Some(explicit_bin) = engine_explicit_bin(engine, settings) {
            if is_windows_wsl_boundary_path(explicit_bin) {
                blockers.push(
                    "Configured CLI path points to WSL. Windows desktop installer will not cross-install into WSL; run a remote daemon inside WSL/Linux or use the manual command there."
                        .to_string(),
                );
            }
        }
    }

    match strategy {
        CliInstallStrategy::NpmGlobal => {
            if run_binary_version("node", path_env.as_ref()).await.is_err() {
                blockers.push("Node is not available on the installer PATH.".to_string());
            }
            if run_binary_version("npm", path_env.as_ref()).await.is_err() {
                blockers.push("npm is not available on the installer PATH.".to_string());
            }
            if let Some(prefix_blocker) = npm_prefix_blocker(path_env.as_ref()).await {
                blockers.push(prefix_blocker);
            }
            if engine == CliInstallEngine::OpenCode && action == CliInstallAction::Uninstall {
                blockers.push(
                    "OpenCode CLI uninstall is intentionally not supported (protects opencode auth and sessions)."
                        .to_string(),
                );
            }
        }
        CliInstallStrategy::OfficialNative => {
            if engine == CliInstallEngine::Grok && action == CliInstallAction::Uninstall {
                blockers.push(
                    "Grok CLI uninstall is intentionally not supported (protects ~/.grok auth and sessions)."
                        .to_string(),
                );
            } else if engine != CliInstallEngine::Claude && engine != CliInstallEngine::Grok {
                blockers.push(
                    "officialNative is only supported for Claude Code installLatest/updateLatest/uninstall."
                        .to_string(),
                );
            } else if engine == CliInstallEngine::Grok && cfg!(target_os = "windows") {
                blockers.push(
                    "Grok CLI installer requires a Unix shell (bash); on Windows run it inside WSL."
                        .to_string(),
                );
            } else if cfg!(target_os = "windows") {
                // PowerShell is expected on Windows; install script itself is official.
            } else if !Path::new("/bin/bash").exists() {
                blockers.push("/bin/bash is required for the native installer.".to_string());
            } else if matches!(
                action,
                CliInstallAction::InstallLatest | CliInstallAction::UpdateLatest
            ) && run_binary_version("curl", path_env.as_ref()).await.is_err()
            {
                blockers.push(if engine == CliInstallEngine::Grok {
                    "curl is required for the Grok CLI installer (curl -fsSL https://x.ai/cli/install.sh | bash)."
                        .to_string()
                } else {
                    "curl is required for Claude Code native installer (curl -fsSL https://claude.ai/install.sh | bash)."
                        .to_string()
                });
            }
            if engine == CliInstallEngine::Claude && action == CliInstallAction::Uninstall {
                warnings.push(
                    "Uninstall removes ~/.local/bin/claude, ~/.local/share/claude, and legacy npm global @anthropic-ai/claude-code. Homebrew/WinGet installs need their own uninstall commands."
                        .to_string(),
                );
            }
        }
        CliInstallStrategy::CliSelfUpdate => {
            blockers.push(
                "cliSelfUpdate is not supported for one-click installer; use npmGlobal for Codex/Kimi."
                    .to_string(),
            );
        }
    }

    let engine_binary = engine_binary_name(engine);
    match check_cli_binary(engine_binary, path_env.clone()).await {
        Ok(_) => {
            if action == CliInstallAction::InstallLatest {
                let hint = match strategy {
                    CliInstallStrategy::OfficialNative => {
                        "already appears to be installed; official native installer will reinstall/refresh."
                    }
                    _ => "already appears to be installed; npmGlobal will reinstall @latest.",
                };
                warnings.push(format!("{engine_binary} {hint}"));
            }
        }
        Err(_) => {
            if action == CliInstallAction::UpdateLatest {
                let hint = match strategy {
                    CliInstallStrategy::OfficialNative => {
                        "is not currently detected; native installer will install the latest release."
                    }
                    CliInstallStrategy::CliSelfUpdate => {
                        "is not currently detected; update requires an existing Claude Code install."
                    }
                    _ => "is not currently detected; npmGlobal will still install @latest.",
                };
                warnings.push(format!("{engine_binary} {hint}"));
            } else if action == CliInstallAction::Uninstall {
                let hint = match strategy {
                    CliInstallStrategy::OfficialNative => {
                        "is not currently detected; native uninstall may be a no-op."
                    }
                    _ => "is not currently detected; npmGlobal uninstall may be a no-op.",
                };
                warnings.push(format!("{engine_binary} {hint}"));
            }
        }
    }

    CliInstallPlan {
        engine,
        action,
        strategy,
        backend,
        platform,
        command_preview: command_preview_for(engine, action),
        can_run: blockers.is_empty(),
        blockers,
        warnings,
        manual_fallback: Some(manual_fallback_for(engine, action)),
    }
}

pub(crate) async fn build_cli_install_plan(
    engine: CliInstallEngine,
    action: CliInstallAction,
    strategy: CliInstallStrategy,
    settings: &AppSettings,
) -> CliInstallPlan {
    build_cli_install_plan_with_backend(
        engine,
        action,
        strategy,
        CliInstallBackend::Local,
        settings,
    )
    .await
}

pub(crate) async fn run_cli_installer_with_progress(
    engine: CliInstallEngine,
    action: CliInstallAction,
    strategy: CliInstallStrategy,
    settings: &AppSettings,
    run_id: Option<String>,
    progress_sink: Option<CliInstallProgressSink>,
) -> Result<CliInstallResult, String> {
    let started = Instant::now();
    let strategy = resolve_effective_strategy(engine, action, strategy);
    let plan = build_cli_install_plan(engine, action, strategy, settings).await;
    if !plan.can_run {
        return Ok(CliInstallResult {
            ok: false,
            engine,
            action,
            strategy,
            backend: CliInstallBackend::Local,
            exit_code: None,
            stdout_summary: None,
            stderr_summary: None,
            details: Some(plan.blockers.join("; ")),
            duration_ms: started.elapsed().as_millis(),
            doctor_result: None,
        });
    }

    let run_id = normalize_run_id(run_id, engine);
    emit_progress(
        &progress_sink,
        CliInstallProgressEvent {
            run_id: run_id.clone(),
            engine,
            action,
            strategy,
            backend: CliInstallBackend::Local,
            phase: CliInstallProgressPhase::Started,
            stream: None,
            message: Some(manual_fallback_for(engine, action)),
            exit_code: None,
            duration_ms: Some(0),
        },
    );

    let command_spec = resolve_installer_command(engine, action, settings).await?;
    let mut command = build_command_for_binary(&command_spec.program);
    if let Some(path_env) = &command_spec.path_env {
        command.env("PATH", path_env);
    }
    command.args(&command_spec.args);
    command.stdout(std::process::Stdio::piped());
    command.stderr(std::process::Stdio::piped());

    let mut child = command.spawn().map_err(|error| {
        let message = format!("failed to start CLI installer: {error}");
        emit_progress(
            &progress_sink,
            CliInstallProgressEvent {
                run_id: run_id.clone(),
                engine,
                action,
                strategy,
                backend: CliInstallBackend::Local,
                phase: CliInstallProgressPhase::Error,
                stream: None,
                message: Some(message.clone()),
                exit_code: None,
                duration_ms: Some(started.elapsed().as_millis()),
            },
        );
        message
    })?;
    let stdout_task = tokio::spawn(read_output_stream(
        child.stdout.take(),
        run_id.clone(),
        engine,
        action,
        strategy,
        CliInstallOutputStream::Stdout,
        progress_sink.clone(),
    ));
    let stderr_task = tokio::spawn(read_output_stream(
        child.stderr.take(),
        run_id.clone(),
        engine,
        action,
        strategy,
        CliInstallOutputStream::Stderr,
        progress_sink.clone(),
    ));

    let status = timeout(Duration::from_secs(INSTALL_TIMEOUT_SECS), child.wait())
        .await
        .map_err(|_| {
            let _ = child.start_kill();
            emit_progress(
                &progress_sink,
                CliInstallProgressEvent {
                    run_id: run_id.clone(),
                    engine,
                    action,
                    strategy,
                    backend: CliInstallBackend::Local,
                    phase: CliInstallProgressPhase::Error,
                    stream: None,
                    message: Some("CLI installer timed out.".to_string()),
                    exit_code: None,
                    duration_ms: Some(started.elapsed().as_millis()),
                },
            );
            "CLI installer timed out.".to_string()
        })?
        .map_err(|error| format!("failed to run CLI installer: {error}"))?;
    let stdout_text = stdout_task
        .await
        .map_err(|error| format!("failed to join CLI installer stdout reader: {error}"))??;
    let stderr_text = stderr_task
        .await
        .map_err(|error| format!("failed to join CLI installer stderr reader: {error}"))??;

    let ok = status.success();
    let (doctor_result, doctor_details) = if ok && action != CliInstallAction::Uninstall {
        match run_post_install_doctor(engine, settings).await {
            Ok(result) => (Some(result), None),
            Err(error) => (
                None,
                Some(format!(
                    "CLI installer completed, but post-install doctor failed: {error}"
                )),
            ),
        }
    } else {
        (None, None)
    };

    let result = CliInstallResult {
        ok,
        engine,
        action,
        strategy,
        backend: CliInstallBackend::Local,
        exit_code: status.code(),
        stdout_summary: summarize_output(&stdout_text),
        stderr_summary: summarize_output(&stderr_text),
        details: if let Some(detail) = doctor_details {
            Some(detail)
        } else if ok {
            None
        } else {
            Some("CLI installer exited with a non-zero status.".to_string())
        },
        duration_ms: started.elapsed().as_millis(),
        doctor_result,
    };
    emit_progress(
        &progress_sink,
        CliInstallProgressEvent {
            run_id,
            engine,
            action,
            strategy,
            backend: CliInstallBackend::Local,
            phase: if ok {
                CliInstallProgressPhase::Finished
            } else {
                CliInstallProgressPhase::Error
            },
            stream: None,
            message: result.details.clone(),
            exit_code: result.exit_code,
            duration_ms: Some(result.duration_ms),
        },
    );
    Ok(result)
}

fn normalize_run_id(run_id: Option<String>, engine: CliInstallEngine) -> String {
    run_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            format!(
                "{}-{}",
                engine_binary_name(engine),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|duration| duration.as_millis())
                    .unwrap_or_default()
            )
        })
}

async fn run_post_install_doctor(
    engine: CliInstallEngine,
    settings: &AppSettings,
) -> Result<Value, String> {
    match engine {
        CliInstallEngine::Codex => {
            crate::codex::run_codex_doctor_with_settings(None, None, settings).await
        }
        CliInstallEngine::Claude => {
            crate::codex::run_claude_doctor_with_settings(None, settings).await
        }
        CliInstallEngine::Kimi => crate::codex::run_kimi_doctor_with_settings(None, settings).await,
        CliInstallEngine::Pi => crate::codex::run_pi_doctor_with_settings(None, settings).await,
        CliInstallEngine::Grok => crate::codex::run_grok_doctor_with_settings(None, settings).await,
        CliInstallEngine::OpenCode => {
            crate::codex::run_opencode_doctor_with_settings(None, settings).await
        }
    }
}

fn summarize_output(output: &str) -> Option<String> {
    let redacted = redact_sensitive_output(output.trim());
    if redacted.is_empty() {
        return None;
    }
    if redacted.chars().count() <= OUTPUT_SUMMARY_LIMIT {
        return Some(redacted);
    }
    Some(format!(
        "{}\n... output truncated ...",
        truncate_for_display(&redacted, OUTPUT_SUMMARY_LIMIT)
    ))
}

fn redact_sensitive_output(output: &str) -> String {
    output
        .split_whitespace()
        .map(|part| {
            let lower = part.to_ascii_lowercase();
            if lower.contains("token=")
                || lower.contains("apikey=")
                || lower.contains("api_key=")
                || lower.contains("authorization:")
            {
                "[REDACTED]"
            } else {
                part
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn summarize_progress_chunk(output: &str) -> Option<String> {
    let redacted = redact_sensitive_output(output.trim());
    if redacted.is_empty() {
        return None;
    }
    if redacted.chars().count() <= PROGRESS_CHUNK_LIMIT {
        return Some(redacted);
    }
    Some(format!(
        "{} ...",
        truncate_for_display(&redacted, PROGRESS_CHUNK_LIMIT)
    ))
}

fn truncate_for_display(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

fn emit_progress(progress_sink: &Option<CliInstallProgressSink>, event: CliInstallProgressEvent) {
    if let Some(sink) = progress_sink {
        sink(event);
    }
}

async fn read_output_stream<R>(
    stream: Option<R>,
    run_id: String,
    engine: CliInstallEngine,
    action: CliInstallAction,
    strategy: CliInstallStrategy,
    output_stream: CliInstallOutputStream,
    progress_sink: Option<CliInstallProgressSink>,
) -> Result<String, String>
where
    R: tokio::io::AsyncRead + Unpin,
{
    let Some(stream) = stream else {
        return Ok(String::new());
    };
    let phase = match output_stream {
        CliInstallOutputStream::Stdout => CliInstallProgressPhase::Stdout,
        CliInstallOutputStream::Stderr => CliInstallProgressPhase::Stderr,
    };
    let mut reader = BufReader::new(stream).lines();
    let mut output = String::new();
    loop {
        let line = reader
            .next_line()
            .await
            .map_err(|error| format!("failed to read CLI installer {output_stream:?}: {error}"))?;
        let Some(line) = line else {
            break;
        };
        output.push_str(&line);
        output.push('\n');
        if let Some(message) = summarize_progress_chunk(&line) {
            emit_progress(
                &progress_sink,
                CliInstallProgressEvent {
                    run_id: run_id.clone(),
                    engine,
                    action,
                    strategy,
                    backend: CliInstallBackend::Local,
                    phase,
                    stream: Some(output_stream),
                    message: Some(message),
                    exit_code: None,
                    duration_ms: None,
                },
            );
        }
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cli_installer_phase_one_command_matrix_is_bounded() {
        assert_eq!(
            command_preview_for(CliInstallEngine::Codex, CliInstallAction::InstallLatest),
            vec![
                "npm".to_string(),
                "install".to_string(),
                "-g".to_string(),
                "@openai/codex@latest".to_string()
            ]
        );
        assert_eq!(
            command_preview_for(CliInstallEngine::Claude, CliInstallAction::InstallLatest),
            claude_native_install_preview()
        );
        assert_eq!(
            command_preview_for(CliInstallEngine::Claude, CliInstallAction::UpdateLatest),
            claude_native_install_preview()
        );
        assert_eq!(
            command_preview_for(CliInstallEngine::Claude, CliInstallAction::Uninstall),
            claude_native_uninstall_preview()
        );
        assert_eq!(
            command_preview_for(CliInstallEngine::Kimi, CliInstallAction::InstallLatest),
            vec![
                "npm".to_string(),
                "install".to_string(),
                "-g".to_string(),
                "@moonshot-ai/kimi-code@latest".to_string()
            ]
        );
        assert_eq!(
            command_preview_for(CliInstallEngine::Kimi, CliInstallAction::Uninstall),
            vec![
                "npm".to_string(),
                "uninstall".to_string(),
                "-g".to_string(),
                "@moonshot-ai/kimi-code".to_string()
            ]
        );
        assert_eq!(
            command_preview_for(CliInstallEngine::Grok, CliInstallAction::InstallLatest),
            grok_native_install_preview()
        );
        assert_eq!(
            command_preview_for(CliInstallEngine::Grok, CliInstallAction::UpdateLatest),
            grok_native_install_preview()
        );
        assert!(
            command_preview_for(CliInstallEngine::Grok, CliInstallAction::Uninstall)
                .join(" ")
                .contains("uninstall is intentionally not supported")
        );
        assert_eq!(
            command_preview_for(CliInstallEngine::OpenCode, CliInstallAction::InstallLatest),
            vec![
                "npm".to_string(),
                "install".to_string(),
                "-g".to_string(),
                "opencode-ai@latest".to_string()
            ]
        );
        assert_eq!(
            command_preview_for(CliInstallEngine::OpenCode, CliInstallAction::UpdateLatest),
            vec![
                "npm".to_string(),
                "install".to_string(),
                "-g".to_string(),
                "opencode-ai@latest".to_string()
            ]
        );
        assert!(
            command_preview_for(CliInstallEngine::OpenCode, CliInstallAction::Uninstall)
                .join(" ")
                .contains("uninstall is intentionally not supported")
        );
    }

    #[test]
    fn claude_effective_strategy_uses_official_native_for_all_actions() {
        assert_eq!(
            resolve_effective_strategy(
                CliInstallEngine::Claude,
                CliInstallAction::InstallLatest,
                CliInstallStrategy::NpmGlobal,
            ),
            CliInstallStrategy::OfficialNative
        );
        assert_eq!(
            resolve_effective_strategy(
                CliInstallEngine::Claude,
                CliInstallAction::UpdateLatest,
                CliInstallStrategy::NpmGlobal,
            ),
            CliInstallStrategy::OfficialNative
        );
        assert_eq!(
            resolve_effective_strategy(
                CliInstallEngine::Claude,
                CliInstallAction::Uninstall,
                CliInstallStrategy::NpmGlobal,
            ),
            CliInstallStrategy::OfficialNative
        );
        assert_eq!(
            resolve_effective_strategy(
                CliInstallEngine::Claude,
                CliInstallAction::UpdateLatest,
                CliInstallStrategy::CliSelfUpdate,
            ),
            CliInstallStrategy::OfficialNative
        );
        assert_eq!(
            resolve_effective_strategy(
                CliInstallEngine::Codex,
                CliInstallAction::InstallLatest,
                CliInstallStrategy::NpmGlobal,
            ),
            CliInstallStrategy::NpmGlobal
        );
        assert_eq!(
            resolve_effective_strategy(
                CliInstallEngine::Grok,
                CliInstallAction::InstallLatest,
                CliInstallStrategy::NpmGlobal,
            ),
            CliInstallStrategy::OfficialNative
        );
        assert_eq!(
            resolve_effective_strategy(
                CliInstallEngine::Grok,
                CliInstallAction::UpdateLatest,
                CliInstallStrategy::CliSelfUpdate,
            ),
            CliInstallStrategy::OfficialNative
        );
        assert_eq!(
            resolve_effective_strategy(
                CliInstallEngine::OpenCode,
                CliInstallAction::InstallLatest,
                CliInstallStrategy::NpmGlobal,
            ),
            CliInstallStrategy::NpmGlobal
        );
        assert_eq!(
            resolve_effective_strategy(
                CliInstallEngine::OpenCode,
                CliInstallAction::UpdateLatest,
                CliInstallStrategy::CliSelfUpdate,
            ),
            CliInstallStrategy::CliSelfUpdate
        );
    }

    #[tokio::test]
    async fn opencode_uninstall_plan_is_blocked() {
        let plan = build_cli_install_plan(
            CliInstallEngine::OpenCode,
            CliInstallAction::Uninstall,
            CliInstallStrategy::NpmGlobal,
            &AppSettings::default(),
        )
        .await;

        assert!(!plan.can_run);
        assert!(plan
            .blockers
            .iter()
            .any(|blocker| blocker.contains("uninstall is intentionally not supported")));
    }

    #[tokio::test]
    async fn grok_uninstall_plan_is_blocked() {
        let plan = build_cli_install_plan(
            CliInstallEngine::Grok,
            CliInstallAction::Uninstall,
            CliInstallStrategy::NpmGlobal,
            &AppSettings::default(),
        )
        .await;

        assert!(!plan.can_run);
        assert!(plan
            .blockers
            .iter()
            .any(|blocker| blocker.contains("uninstall is intentionally not supported")));
    }

    #[tokio::test]
    async fn grok_install_plan_uses_official_native_without_npm() {
        let plan = build_cli_install_plan(
            CliInstallEngine::Grok,
            CliInstallAction::InstallLatest,
            CliInstallStrategy::NpmGlobal,
            &AppSettings::default(),
        )
        .await;

        assert_eq!(plan.strategy, CliInstallStrategy::OfficialNative);
        assert!(!plan
            .blockers
            .iter()
            .any(|blocker| blocker.to_ascii_lowercase().contains("npm")));
        assert_eq!(plan.command_preview, grok_native_install_preview());
    }

    #[tokio::test]
    async fn cli_installer_self_update_strategy_is_blocked() {
        let plan = build_cli_install_plan(
            CliInstallEngine::Codex,
            CliInstallAction::UpdateLatest,
            CliInstallStrategy::CliSelfUpdate,
            &AppSettings::default(),
        )
        .await;

        assert!(!plan.can_run);
        assert!(plan
            .blockers
            .iter()
            .any(|blocker| blocker.contains("cliSelfUpdate")));
    }

    #[tokio::test]
    async fn claude_install_plan_does_not_require_npm() {
        let plan = build_cli_install_plan(
            CliInstallEngine::Claude,
            CliInstallAction::InstallLatest,
            CliInstallStrategy::NpmGlobal,
            &AppSettings::default(),
        )
        .await;

        assert_eq!(plan.strategy, CliInstallStrategy::OfficialNative);
        assert!(!plan
            .blockers
            .iter()
            .any(|blocker| blocker.to_ascii_lowercase().contains("npm")));
        assert!(!plan
            .blockers
            .iter()
            .any(|blocker| blocker.to_ascii_lowercase().contains("node")));
        assert_eq!(plan.command_preview, claude_native_install_preview());
    }

    #[test]
    fn cli_installer_output_summary_redacts_and_truncates() {
        let summary = summarize_output(&format!(
            "token=secret {}",
            "x".repeat(OUTPUT_SUMMARY_LIMIT + 20)
        ))
        .expect("summary");
        assert!(summary.contains("[REDACTED]"));
        assert!(summary.contains("output truncated"));
        assert!(!summary.contains("token=secret"));
    }

    #[test]
    fn cli_installer_progress_chunk_is_redacted_and_bounded() {
        let chunk = summarize_progress_chunk(&format!(
            "api_key=secret {}",
            "x".repeat(PROGRESS_CHUNK_LIMIT + 20)
        ))
        .expect("chunk");
        assert!(chunk.contains("[REDACTED]"));
        assert!(chunk.ends_with(" ..."));
        assert!(!chunk.contains("api_key=secret"));
    }

    #[test]
    fn cli_installer_truncates_unicode_without_panicking() {
        let summary = summarize_output(&"安装".repeat(OUTPUT_SUMMARY_LIMIT + 1)).expect("summary");
        assert!(summary.contains("output truncated"));
        assert!(summary.is_char_boundary(summary.len()));
    }

    #[test]
    fn cli_installer_blank_run_id_falls_back_to_generated_id() {
        let run_id = normalize_run_id(Some("   ".to_string()), CliInstallEngine::Claude);
        assert!(run_id.starts_with("claude-"));
    }

    #[test]
    fn cli_installer_detects_windows_wsl_boundary_paths() {
        assert!(is_windows_wsl_boundary_path(r"\\wsl$\Ubuntu\home\me\.npm"));
        assert!(is_windows_wsl_boundary_path(
            r"\\wsl.localhost\Ubuntu\home\me\.npm"
        ));
        assert!(!is_windows_wsl_boundary_path(
            r"C:\Users\me\AppData\Roaming\npm"
        ));
    }

    #[test]
    fn pick_claude_version_line_prefers_claude_code_output() {
        let picked = pick_claude_version_line("同步配置…\nreclaude: ok\n2.0.52 (Claude Code)\n")
            .expect("version line");
        assert_eq!(picked, "2.0.52 (Claude Code)");
    }

    #[test]
    fn pick_claude_version_line_ignores_interactive_shell_proxy_banner() {
        let picked = pick_claude_version_line(
            "✅ 代理已开启 → http://127.0.0.1:7890\n/opt/homebrew/bin/claude\n2.0.52 (Claude Code)\n",
        )
        .expect("version line");
        assert_eq!(picked, "2.0.52 (Claude Code)");
        assert_eq!(
            pick_claude_version_line("✅ 代理已开启 → http://127.0.0.1:7890\n"),
            None
        );
    }

    #[test]
    fn extract_semver_from_noisy_version_strings() {
        assert_eq!(
            extract_semver("1.2.3"),
            Some(SemVerParts {
                major: 1,
                minor: 2,
                patch: 3
            })
        );
        assert_eq!(
            extract_semver("claude 2.10.4 (build)"),
            Some(SemVerParts {
                major: 2,
                minor: 10,
                patch: 4
            })
        );
        assert_eq!(extract_semver("not-a-version"), None);
        assert_eq!(extract_semver(""), None);
    }

    #[test]
    fn update_available_compares_semver() {
        assert!(is_update_available("1.0.0", "1.0.1"));
        assert!(is_update_available("claude 1.2.3", "2.0.0"));
        assert!(!is_update_available("2.0.0", "1.9.9"));
        assert!(!is_update_available("1.0.0", "1.0.0"));
        assert!(!is_update_available("1.0.0", "not-a-version"));
        assert!(!is_update_available("bad", "1.0.0"));
    }

    #[test]
    fn registry_package_names_are_whitelist_only() {
        assert_eq!(
            registry_package_name_for_engine(CliInstallEngine::Codex),
            "@openai/codex"
        );
        assert_eq!(
            registry_package_name_for_engine(CliInstallEngine::Claude),
            "@anthropic-ai/claude-code"
        );
        assert_eq!(
            registry_package_name_for_engine(CliInstallEngine::Kimi),
            "@moonshot-ai/kimi-code"
        );
        assert_eq!(
            registry_package_name_for_engine(CliInstallEngine::OpenCode),
            "opencode-ai"
        );
    }
}
