//! OMP-owned environment assembly boundary for spawned CLI processes.
//!
//! spawn 路径禁止隐式全量继承父进程 env：所有子进程环境必须经过
//! `OmpEnvironmentSpec` 显式组装（allowlist 继承 + profile home 注入 +
//! 显式 overlay）。secret 类变量（名称含 TOKEN/SECRET/PASSWORD/CREDENTIAL/
//! AUTH/API_KEY 等）在任何 Debug/日志投影中一律 redact，绝不落明文。

use std::collections::BTreeMap;
use std::fmt;
use std::path::PathBuf;

/// profile home 注入键（mossx 侧契约常量）。
///
/// 证据状态：OMP 本地证据只证明默认 profile home 是 `~/.omp`
/// （omp_auth.rs 的 agent.db 路径约定）；环境变量覆盖键尚无协议证据，
/// 集中在这一个常量，协议资格确认后只改这里。
pub const OMP_PROFILE_HOME_ENV: &str = "OMP_HOME";

const REDACTED_VALUE: &str = "***";

/// credential/auth source 的引用（绝不携带 secret 值本体）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OmpCredentialSource {
    /// 本地 `~/.omp/agent/agent.db` 登录态（omp_auth.rs 已验证的投影面）。
    LocalAgentDb,
    /// `omp auth-broker` 远程凭据保险库。
    AuthBroker,
    /// 以环境变量名引用凭据来源；assembly 会把该变量名加入继承 allowlist，
    /// 值本身仍只在子进程 env 中传递，日志投影中 redact。
    EnvironmentVariable(String),
}

/// 结构化 environment assembly 规格。字段即全部环境来源，无隐式通道。
#[derive(Clone, PartialEq, Eq)]
pub struct OmpEnvironmentSpec {
    /// OMP profile home；存在时以 `OMP_PROFILE_HOME_ENV` 注入子进程。
    pub profile_home: Option<PathBuf>,
    /// credential/auth source 引用（不含 secret 值）。
    pub credential_source: Option<OmpCredentialSource>,
    /// 允许从父进程继承的精确变量名。
    pub inherit_allowlist: Vec<String>,
    /// 允许从父进程继承的变量名前缀（如 `OMP_`）。
    pub inherit_prefixes: Vec<String>,
    /// 显式 overlay，优先级最高（覆盖继承与 profile home 注入）。
    pub overlay: BTreeMap<String, String>,
}

impl Default for OmpEnvironmentSpec {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Debug for OmpEnvironmentSpec {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let redacted_overlay: BTreeMap<&String, String> = self
            .overlay
            .keys()
            .map(|key| (key, redact_env_value(key, self.overlay.get(key))))
            .collect();
        formatter
            .debug_struct("OmpEnvironmentSpec")
            .field("profile_home", &self.profile_home)
            .field("credential_source", &self.credential_source)
            .field("inherit_allowlist", &self.inherit_allowlist)
            .field("inherit_prefixes", &self.inherit_prefixes)
            .field("overlay", &redacted_overlay)
            .finish()
    }
}

/// 变量名是否 secret 类（用于日志 redaction；过宽掩码是安全方向）。
fn is_secret_env_name(name: &str) -> bool {
    let upper = name.to_ascii_uppercase();
    [
        "TOKEN",
        "SECRET",
        "PASSWORD",
        "CREDENTIAL",
        "AUTH",
        "API_KEY",
        "APIKEY",
        "_KEY",
    ]
    .iter()
    .any(|needle| upper.contains(needle))
}

fn redact_env_value(name: &str, value: Option<&String>) -> String {
    match value {
        Some(_) if is_secret_env_name(name) => REDACTED_VALUE.to_string(),
        Some(value) => value.clone(),
        None => REDACTED_VALUE.to_string(),
    }
}

impl OmpEnvironmentSpec {
    pub fn new() -> Self {
        Self {
            profile_home: None,
            credential_source: None,
            inherit_allowlist: Vec::new(),
            inherit_prefixes: Vec::new(),
            overlay: BTreeMap::new(),
        }
    }

    /// 默认继承面：只保留子进程存活与网络访问必需的最小集合。
    /// OMP CLI 需要 PATH/HOME 定位自身与 profile home，需要代理/证书变量
    /// 访问 provider API；其余父进程 env 一律不继承。
    pub fn default_inherit() -> Self {
        let mut spec = Self::new();
        for name in [
            "PATH",
            "HOME",
            "LANG",
            "LC_ALL",
            "LC_CTYPE",
            "TMPDIR",
            "TMP",
            "TEMP",
            "HTTP_PROXY",
            "HTTPS_PROXY",
            "ALL_PROXY",
            "NO_PROXY",
            "http_proxy",
            "https_proxy",
            "all_proxy",
            "no_proxy",
            "SSL_CERT_FILE",
            "NODE_EXTRA_CA_CERTS",
            "XDG_CONFIG_HOME",
            "XDG_DATA_HOME",
        ] {
            spec.inherit_allowlist.push(name.to_string());
        }
        #[cfg(windows)]
        for name in ["SYSTEMROOT", "COMSPEC", "PATHEXT", "USERPROFILE", "APPDATA"] {
            spec.inherit_allowlist.push(name.to_string());
        }
        // OMP_* 前缀是 OMP CLI 自身的配置通道（如 profile/feature 覆盖）。
        spec.inherit_prefixes.push("OMP_".to_string());
        spec
    }

    pub fn with_profile_home(mut self, home: impl Into<PathBuf>) -> Self {
        self.profile_home = Some(home.into());
        self
    }

    pub fn with_credential_source(mut self, source: OmpCredentialSource) -> Self {
        self.credential_source = Some(source);
        self
    }

    pub fn with_overlay(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.overlay.insert(key.into(), value.into());
        self
    }

    /// 显式组装：allowlist/前缀过滤父进程 env → credential source 引用的
    /// 变量名自动放行 → profile home 注入 → overlay 覆盖。优先级从低到高。
    pub fn assemble_from<I>(&self, parent: I) -> OmpAssembledEnv
    where
        I: IntoIterator<Item = (String, String)>,
    {
        let credential_env_name = match &self.credential_source {
            Some(OmpCredentialSource::EnvironmentVariable(name)) => Some(name.as_str()),
            _ => None,
        };
        let mut pairs = BTreeMap::new();
        for (name, value) in parent {
            let allowed = self.inherit_allowlist.iter().any(|entry| entry == &name)
                || self
                    .inherit_prefixes
                    .iter()
                    .any(|prefix| name.starts_with(prefix.as_str()))
                || credential_env_name == Some(name.as_str());
            if allowed {
                pairs.insert(name, value);
            }
        }
        if let Some(home) = &self.profile_home {
            pairs.insert(
                OMP_PROFILE_HOME_ENV.to_string(),
                home.to_string_lossy().into_owned(),
            );
        }
        for (key, value) in &self.overlay {
            pairs.insert(key.clone(), value.clone());
        }
        OmpAssembledEnv { pairs }
    }

    /// spawn 边界的唯一入口：从当前进程环境显式组装。
    pub fn assemble_from_current_process(&self) -> OmpAssembledEnv {
        self.assemble_from(std::env::vars())
    }
}

/// 组装结果。`Debug`/`redacted_pairs` 对 secret 类变量一律掩码。
#[derive(Clone, PartialEq, Eq)]
pub struct OmpAssembledEnv {
    pairs: BTreeMap<String, String>,
}

impl OmpAssembledEnv {
    pub fn pairs(&self) -> &BTreeMap<String, String> {
        &self.pairs
    }

    /// 日志/诊断投影：secret 值掩码后的副本。
    pub fn redacted_pairs(&self) -> BTreeMap<String, String> {
        self.pairs
            .iter()
            .map(|(key, value)| (key.clone(), redact_env_value(key, Some(value))))
            .collect()
    }

    /// 应用到子进程命令：先清空隐式继承，再逐项设置显式组装结果。
    pub fn apply(&self, command: &mut tokio::process::Command) {
        command.env_clear();
        for (key, value) in &self.pairs {
            command.env(key, value);
        }
    }
}

impl fmt::Debug for OmpAssembledEnv {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("OmpAssembledEnv")
            .field("pairs", &self.redacted_pairs())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parent_env() -> Vec<(String, String)> {
        vec![
            ("PATH".to_string(), "/usr/bin".to_string()),
            ("HOME".to_string(), "/home/test".to_string()),
            ("OMP_VERBOSE".to_string(), "1".to_string()),
            ("RANDOM_UNRELATED".to_string(), "nope".to_string()),
            (
                "AWS_SECRET_ACCESS_KEY".to_string(),
                "supersecret".to_string(),
            ),
        ]
    }

    #[test]
    fn allowlist_filters_parent_env_and_prefix_inherits_omp_vars() {
        let spec = OmpEnvironmentSpec::default_inherit();
        let assembled = spec.assemble_from(parent_env());
        assert_eq!(
            assembled.pairs().get("PATH").map(String::as_str),
            Some("/usr/bin")
        );
        assert_eq!(
            assembled.pairs().get("OMP_VERBOSE").map(String::as_str),
            Some("1")
        );
        assert!(!assembled.pairs().contains_key("RANDOM_UNRELATED"));
        // 非 allowlist 的 secret 绝不泄漏进子进程。
        assert!(!assembled.pairs().contains_key("AWS_SECRET_ACCESS_KEY"));
    }

    #[test]
    fn overlay_wins_over_inherited_and_profile_home_values() {
        let spec = OmpEnvironmentSpec::default_inherit()
            .with_profile_home("/profiles/a")
            .with_overlay("PATH", "/custom/bin")
            .with_overlay(OMP_PROFILE_HOME_ENV, "/profiles/override");
        let assembled = spec.assemble_from(parent_env());
        assert_eq!(
            assembled.pairs().get("PATH").map(String::as_str),
            Some("/custom/bin")
        );
        assert_eq!(
            assembled
                .pairs()
                .get(OMP_PROFILE_HOME_ENV)
                .map(String::as_str),
            Some("/profiles/override")
        );
    }

    #[test]
    fn profile_home_is_injected_under_the_contract_env_key() {
        let spec = OmpEnvironmentSpec::new().with_profile_home("/profiles/main");
        let assembled = spec.assemble_from(parent_env());
        assert_eq!(
            assembled
                .pairs()
                .get(OMP_PROFILE_HOME_ENV)
                .map(String::as_str),
            Some("/profiles/main")
        );
        // 未设置 profile home 时不注入。
        let without = OmpEnvironmentSpec::new().assemble_from(parent_env());
        assert!(!without.pairs().contains_key(OMP_PROFILE_HOME_ENV));
    }

    #[test]
    fn credential_source_env_reference_is_inherited_but_redacted_in_logs() {
        let spec = OmpEnvironmentSpec::new().with_credential_source(
            OmpCredentialSource::EnvironmentVariable("AWS_SECRET_ACCESS_KEY".to_string()),
        );
        let assembled = spec.assemble_from(parent_env());
        assert_eq!(
            assembled
                .pairs()
                .get("AWS_SECRET_ACCESS_KEY")
                .map(String::as_str),
            Some("supersecret")
        );
        assert_eq!(
            assembled.redacted_pairs().get("AWS_SECRET_ACCESS_KEY"),
            Some(&REDACTED_VALUE.to_string())
        );
        let debug = format!("{assembled:?}");
        assert!(!debug.contains("supersecret"));
        let spec_debug = format!(
            "{:?}",
            OmpEnvironmentSpec::new().with_overlay("OMP_API_TOKEN", "plaintext-token")
        );
        assert!(!spec_debug.contains("plaintext-token"));
    }

    #[test]
    fn non_secret_values_remain_visible_in_redacted_projection() {
        let assembled = OmpEnvironmentSpec::default_inherit().assemble_from(parent_env());
        assert_eq!(
            assembled.redacted_pairs().get("PATH").map(String::as_str),
            Some("/usr/bin")
        );
    }
}
