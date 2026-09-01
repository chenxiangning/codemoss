//! OMP release hardening contracts shared by the app and daemon paths.
//!
//! 指标面：`OmpMetrics` 是进程内 recorder（无全局 telemetry sink，参照
//! claude_history.rs 的 struct metrics 模式），真实事件点在 omp_process /
//! omp_rpc / omp_rpc_process / omp_protocol / run_omp_turn(app+daemon) 接线。
//! ToolLatency/JobLatency 无协议计时证据，保持 Unknown，不编造。

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use super::events::EngineEvent;

pub const OMP_RELEASE_CONTRACT_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OmpReleasePath {
    App,
    Daemon,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OmpReleaseFlag {
    Native,
    Acp,
    Rpc,
    SharedSession,
}

impl OmpReleaseFlag {
    pub const fn env_key(self) -> &'static str {
        match self {
            Self::Native => "CCGUI_OMP_NATIVE_ENABLED",
            Self::Acp => "CCGUI_OMP_ACP_ENABLED",
            Self::Rpc => "CCGUI_OMP_RPC_ENABLED",
            Self::SharedSession => "CCGUI_OMP_SHARED_SESSION_ENABLED",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OmpMetricState {
    /// A real event/process hook exists and may emit this metric.
    Hooked,
    /// The metric is part of the release contract, but no stable sink exists.
    ContractOnly,
    /// The protocol does not expose enough evidence for this metric yet.
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OmpMetric {
    Startup,
    Ack,
    FirstDelta,
    Terminal,
    Recovery,
    FrameSize,
    ToolLatency,
    JobLatency,
}

impl OmpMetric {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Startup => "omp.startup",
            Self::Ack => "omp.ack",
            Self::FirstDelta => "omp.first-delta",
            Self::Terminal => "omp.terminal",
            Self::Recovery => "omp.recovery",
            Self::FrameSize => "omp.frame-size",
            Self::ToolLatency => "omp.tool-latency",
            Self::JobLatency => "omp.job-latency",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct OmpMetricContract {
    pub metric: OmpMetric,
    pub state: OmpMetricState,
    /// Evidence-backed explanation shown in release diagnostics.
    pub rationale: &'static str,
}

/// 指标契约显式记录接线状态：Hooked = 真实事件点已接 OmpMetrics；
/// Unknown = 协议无足够证据，禁止编造。
pub const OMP_METRIC_CONTRACTS: [OmpMetricContract; 8] = [
    OmpMetricContract {
        metric: OmpMetric::Startup,
        state: OmpMetricState::Hooked,
        rationale: "OmpMetrics.record_startup at ACP/RPC spawn (omp_process.rs, omp_rpc_process.rs)",
    },
    OmpMetricContract {
        metric: OmpMetric::Ack,
        state: OmpMetricState::Hooked,
        rationale: "OmpMetrics.record_ack at RPC ready handshake (omp_rpc.rs) and ACP initialize (omp_process.rs)",
    },
    OmpMetricContract {
        metric: OmpMetric::FirstDelta,
        state: OmpMetricState::Hooked,
        rationale: "OmpTurnMetrics.observe_event at first canonical TextDelta/ReasoningDelta (run_omp_turn, app + daemon)",
    },
    OmpMetricContract {
        metric: OmpMetric::Terminal,
        state: OmpMetricState::Hooked,
        rationale: "OmpTurnMetrics.finish_* at typed terminal settlement emission (run_omp_turn, app + daemon)",
    },
    OmpMetricContract {
        metric: OmpMetric::Recovery,
        state: OmpMetricState::Hooked,
        rationale: "OmpMetrics.record_recovery at RPC transport-failure settlement (omp_rpc.rs) and non-interrupt ACP turn failure",
    },
    OmpMetricContract {
        metric: OmpMetric::FrameSize,
        state: OmpMetricState::Hooked,
        rationale: "OmpMetrics.record_frame / record_frame_rejected in OmpFrameDecoder (omp_protocol.rs)",
    },
    OmpMetricContract {
        metric: OmpMetric::ToolLatency,
        state: OmpMetricState::Unknown,
        rationale: "tool start/end timing contract is not qualified",
    },
    OmpMetricContract {
        metric: OmpMetric::JobLatency,
        state: OmpMetricState::Unknown,
        rationale: "job lifecycle timing contract is not qualified",
    },
];

/// 进程内 OMP 指标 recorder。热路径零分配：仅 atomic fetch_add / fetch_max。
#[derive(Debug)]
pub struct OmpMetrics {
    startup_count: AtomicU64,
    startup_ms_total: AtomicU64,
    startup_ms_max: AtomicU64,
    ack_count: AtomicU64,
    first_delta_count: AtomicU64,
    first_delta_ms_total: AtomicU64,
    terminal_completed_count: AtomicU64,
    terminal_cancelled_count: AtomicU64,
    terminal_failed_count: AtomicU64,
    recovery_count: AtomicU64,
    frame_count: AtomicU64,
    frame_bytes_total: AtomicU64,
    frame_bytes_max: AtomicU64,
    frame_rejected_count: AtomicU64,
}

/// OMP 全局指标 recorder（app 与 daemon 各自进程内单例）。
pub static OMP_METRICS: OmpMetrics = OmpMetrics::new();

impl OmpMetrics {
    pub const fn new() -> Self {
        Self {
            startup_count: AtomicU64::new(0),
            startup_ms_total: AtomicU64::new(0),
            startup_ms_max: AtomicU64::new(0),
            ack_count: AtomicU64::new(0),
            first_delta_count: AtomicU64::new(0),
            first_delta_ms_total: AtomicU64::new(0),
            terminal_completed_count: AtomicU64::new(0),
            terminal_cancelled_count: AtomicU64::new(0),
            terminal_failed_count: AtomicU64::new(0),
            recovery_count: AtomicU64::new(0),
            frame_count: AtomicU64::new(0),
            frame_bytes_total: AtomicU64::new(0),
            frame_bytes_max: AtomicU64::new(0),
            frame_rejected_count: AtomicU64::new(0),
        }
    }

    pub fn record_startup(&self, elapsed: Duration) {
        let millis = elapsed.as_millis() as u64;
        self.startup_count.fetch_add(1, Ordering::Relaxed);
        self.startup_ms_total.fetch_add(millis, Ordering::Relaxed);
        self.startup_ms_max.fetch_max(millis, Ordering::Relaxed);
    }

    pub fn record_ack(&self) {
        self.ack_count.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_first_delta(&self, elapsed: Duration) {
        self.first_delta_count.fetch_add(1, Ordering::Relaxed);
        self.first_delta_ms_total
            .fetch_add(elapsed.as_millis() as u64, Ordering::Relaxed);
    }

    pub fn record_terminal_completed(&self) {
        self.terminal_completed_count
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_terminal_cancelled(&self) {
        self.terminal_cancelled_count
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_terminal_failed(&self) {
        self.terminal_failed_count.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_recovery(&self) {
        self.recovery_count.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_frame(&self, bytes: usize) {
        self.frame_count.fetch_add(1, Ordering::Relaxed);
        self.frame_bytes_total
            .fetch_add(bytes as u64, Ordering::Relaxed);
        self.frame_bytes_max
            .fetch_max(bytes as u64, Ordering::Relaxed);
    }

    pub fn record_frame_rejected(&self) {
        self.frame_rejected_count.fetch_add(1, Ordering::Relaxed);
    }

    pub fn snapshot(&self) -> OmpMetricsSnapshot {
        OmpMetricsSnapshot {
            startup_count: self.startup_count.load(Ordering::Relaxed),
            startup_ms_total: self.startup_ms_total.load(Ordering::Relaxed),
            startup_ms_max: self.startup_ms_max.load(Ordering::Relaxed),
            ack_count: self.ack_count.load(Ordering::Relaxed),
            first_delta_count: self.first_delta_count.load(Ordering::Relaxed),
            first_delta_ms_total: self.first_delta_ms_total.load(Ordering::Relaxed),
            terminal_completed_count: self.terminal_completed_count.load(Ordering::Relaxed),
            terminal_cancelled_count: self.terminal_cancelled_count.load(Ordering::Relaxed),
            terminal_failed_count: self.terminal_failed_count.load(Ordering::Relaxed),
            recovery_count: self.recovery_count.load(Ordering::Relaxed),
            frame_count: self.frame_count.load(Ordering::Relaxed),
            frame_bytes_total: self.frame_bytes_total.load(Ordering::Relaxed),
            frame_bytes_max: self.frame_bytes_max.load(Ordering::Relaxed),
            frame_rejected_count: self.frame_rejected_count.load(Ordering::Relaxed),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OmpMetricsSnapshot {
    pub startup_count: u64,
    pub startup_ms_total: u64,
    pub startup_ms_max: u64,
    pub ack_count: u64,
    pub first_delta_count: u64,
    pub first_delta_ms_total: u64,
    pub terminal_completed_count: u64,
    pub terminal_cancelled_count: u64,
    pub terminal_failed_count: u64,
    pub recovery_count: u64,
    pub frame_count: u64,
    pub frame_bytes_total: u64,
    pub frame_bytes_max: u64,
    pub frame_rejected_count: u64,
}

/// 单 turn 的指标 guard：turn 起点计时，首个 canonical delta 只记一次，
/// terminal 结算按 typed outcome 各记一次。
#[derive(Debug)]
pub struct OmpTurnMetrics {
    started: Instant,
    first_delta_recorded: bool,
}

impl Default for OmpTurnMetrics {
    fn default() -> Self {
        Self::start()
    }
}

impl OmpTurnMetrics {
    pub fn start() -> Self {
        Self {
            started: Instant::now(),
            first_delta_recorded: false,
        }
    }

    /// 在 canonical 事件投影点调用；首个 TextDelta/ReasoningDelta 记录
    /// FirstDelta 延迟，其余事件不产生指标。
    pub fn observe_event(&mut self, event: &EngineEvent) {
        if self.first_delta_recorded {
            return;
        }
        if matches!(
            event,
            EngineEvent::TextDelta { .. } | EngineEvent::ReasoningDelta { .. }
        ) {
            self.first_delta_recorded = true;
            OMP_METRICS.record_first_delta(self.started.elapsed());
        }
    }

    pub fn finish_completed(&self) {
        OMP_METRICS.record_terminal_completed();
    }

    pub fn finish_cancelled(&self) {
        OMP_METRICS.record_terminal_cancelled();
    }

    pub fn finish_failed(&self) {
        OMP_METRICS.record_terminal_failed();
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct OmpReleaseFlags {
    pub native: bool,
    pub acp: bool,
    pub rpc: bool,
    /// Shared Session remains fail-closed until P14 qualification is complete.
    pub shared_session: bool,
}

impl Default for OmpReleaseFlags {
    fn default() -> Self {
        Self {
            native: true,
            acp: true,
            rpc: true,
            shared_session: false,
        }
    }
}

impl OmpReleaseFlags {
    pub fn from_lookup<F>(lookup: F) -> Self
    where
        F: Fn(OmpReleaseFlag) -> Option<String>,
    {
        let defaults = Self::default();
        Self {
            native: resolve_flag(lookup(OmpReleaseFlag::Native), defaults.native),
            acp: resolve_flag(lookup(OmpReleaseFlag::Acp), defaults.acp),
            rpc: resolve_flag(lookup(OmpReleaseFlag::Rpc), defaults.rpc),
            // Never allow an environment variable to opt into an unqualified
            // Shared Session path.
            shared_session: false,
        }
    }

    pub const fn enabled(self, flag: OmpReleaseFlag) -> bool {
        match flag {
            OmpReleaseFlag::Native => self.native,
            OmpReleaseFlag::Acp => self.acp,
            OmpReleaseFlag::Rpc => self.rpc,
            OmpReleaseFlag::SharedSession => self.shared_session,
        }
    }
}

fn resolve_flag(value: Option<String>, default: bool) -> bool {
    match value.as_deref().map(str::trim).map(str::to_ascii_lowercase) {
        Some(value) if matches!(value.as_str(), "1" | "true" | "on" | "yes") => true,
        Some(value) if matches!(value.as_str(), "0" | "false" | "off" | "no") => false,
        Some(_) => false,
        None => default,
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OmpResidentBuildIdentity {
    pub binary_path: PathBuf,
    pub binary_mtime_ms: u128,
    pub process_started_at_ms: u128,
}

impl OmpResidentBuildIdentity {
    pub fn matches(&self, expected_path: &Path, expected_mtime_ms: u128) -> bool {
        self.binary_path == expected_path
            && self.binary_mtime_ms == expected_mtime_ms
            && self.binary_mtime_ms <= self.process_started_at_ms
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OmpRollbackReason {
    DisabledByFlag,
    ResidentBuildMismatch,
    SharedSessionUnqualified,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct OmpRollbackGuard {
    pub rollback_required: bool,
    pub reason: Option<OmpRollbackReason>,
}

impl OmpRollbackGuard {
    pub const fn allow() -> Self {
        Self {
            rollback_required: false,
            reason: None,
        }
    }

    pub const fn reject(reason: OmpRollbackReason) -> Self {
        Self {
            rollback_required: true,
            reason: Some(reason),
        }
    }
}

pub fn evaluate_launch(
    path: OmpReleasePath,
    flags: OmpReleaseFlags,
    resident_identity_matches: bool,
) -> OmpRollbackGuard {
    let enabled = match path {
        OmpReleasePath::App => flags.native && flags.acp,
        OmpReleasePath::Daemon => flags.native && flags.acp,
    };
    if !enabled {
        return OmpRollbackGuard::reject(OmpRollbackReason::DisabledByFlag);
    }
    if !resident_identity_matches {
        return OmpRollbackGuard::reject(OmpRollbackReason::ResidentBuildMismatch);
    }
    OmpRollbackGuard::allow()
}

/// OMP 持久化状态（feature flags / capability cache / profile-scoped 状态）
/// 的当前 schema 版本。变更持久化 shape 时必须递增并实现显式迁移。
pub const OMP_PERSISTED_STATE_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OmpPersistedState {
    pub schema_version: u32,
    pub release_flags: OmpReleaseFlags,
    /// capability key → Decision 6 状态词（supported/unsupported/unknown/degraded）。
    #[serde(default)]
    pub capability_cache: BTreeMap<String, String>,
    /// profile id → profile-scoped 状态（如最近一次 profile home 解析结果）。
    #[serde(default)]
    pub profile_state: BTreeMap<String, String>,
}

impl OmpPersistedState {
    pub fn current(release_flags: OmpReleaseFlags) -> Self {
        Self {
            schema_version: OMP_PERSISTED_STATE_SCHEMA_VERSION,
            release_flags,
            capability_cache: BTreeMap::new(),
            profile_state: BTreeMap::new(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct OmpMigrationRecord {
    pub from: u32,
    pub to: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OmpMigrationOutcome {
    pub state: OmpPersistedState,
    /// 发生了真实迁移时为 Some(from→to)，可观测；同版本直通为 None。
    pub record: Option<OmpMigrationRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OmpMigrationError {
    /// 未知版本 fail-closed：绝不猜测新 schema 的语义。
    UnknownVersion {
        found: u32,
    },
    Malformed {
        message: String,
    },
}

impl std::fmt::Display for OmpMigrationError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnknownVersion { found } => write!(
                formatter,
                "OMP persisted state schema version {found} is not supported (max {OMP_PERSISTED_STATE_SCHEMA_VERSION})"
            ),
            Self::Malformed { message } => {
                write!(formatter, "OMP persisted state is malformed: {message}")
            }
        }
    }
}

impl std::error::Error for OmpMigrationError {}

/// 显式迁移入口：v0（裸 flags 对象，无 envelope）→ v1；当前版本直通；
/// 未知版本 fail-closed。迁移结果携带 from/to 记录供日志观测。
pub fn migrate_omp_persisted_state(
    raw: &serde_json::Value,
) -> Result<OmpMigrationOutcome, OmpMigrationError> {
    let version = raw.get("schemaVersion").and_then(serde_json::Value::as_u64);
    match version {
        None => {
            // v0 legacy：顶层即 flags 对象。未知字段忽略，缺失字段取默认；
            // shared_session 保持 fail-closed（不由旧数据开启）。
            let flags = OmpReleaseFlags {
                native: raw
                    .get("native")
                    .and_then(serde_json::Value::as_bool)
                    .unwrap_or(true),
                acp: raw
                    .get("acp")
                    .and_then(serde_json::Value::as_bool)
                    .unwrap_or(true),
                rpc: raw
                    .get("rpc")
                    .and_then(serde_json::Value::as_bool)
                    .unwrap_or(true),
                shared_session: false,
            };
            Ok(OmpMigrationOutcome {
                state: OmpPersistedState::current(flags),
                record: Some(OmpMigrationRecord {
                    from: 0,
                    to: OMP_PERSISTED_STATE_SCHEMA_VERSION,
                }),
            })
        }
        Some(found) if found == u64::from(OMP_PERSISTED_STATE_SCHEMA_VERSION) => {
            let state: OmpPersistedState =
                serde_json::from_value(raw.clone()).map_err(|error| {
                    OmpMigrationError::Malformed {
                        message: error.to_string(),
                    }
                })?;
            // 持久化数据不得解除 Shared Session 的 fail-closed 闸门。
            let state = OmpPersistedState {
                release_flags: OmpReleaseFlags {
                    shared_session: false,
                    ..state.release_flags
                },
                ..state
            };
            Ok(OmpMigrationOutcome {
                state,
                record: None,
            })
        }
        Some(found) => Err(OmpMigrationError::UnknownVersion {
            found: u32::try_from(found).unwrap_or(u32::MAX),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_keep_native_and_acp_open_but_shared_session_closed() {
        let flags = OmpReleaseFlags::default();
        assert!(flags.enabled(OmpReleaseFlag::Native));
        assert!(flags.enabled(OmpReleaseFlag::Acp));
        assert!(flags.enabled(OmpReleaseFlag::Rpc));
        assert!(!flags.enabled(OmpReleaseFlag::SharedSession));
    }

    #[test]
    fn invalid_flag_values_fail_closed_and_shared_cannot_be_enabled() {
        let flags = OmpReleaseFlags::from_lookup(|flag| match flag {
            OmpReleaseFlag::Native => Some("maybe".to_string()),
            OmpReleaseFlag::Acp => Some("0".to_string()),
            OmpReleaseFlag::Rpc => Some("true".to_string()),
            OmpReleaseFlag::SharedSession => Some("true".to_string()),
        });
        assert!(!flags.native);
        assert!(!flags.acp);
        assert!(flags.rpc);
        assert!(!flags.shared_session);
    }

    #[test]
    fn resident_identity_requires_path_mtime_and_process_ancestry_evidence() {
        let identity = OmpResidentBuildIdentity {
            binary_path: PathBuf::from("/opt/omp"),
            binary_mtime_ms: 100,
            process_started_at_ms: 150,
        };
        assert!(identity.matches(Path::new("/opt/omp"), 100));
        assert!(!identity.matches(Path::new("/opt/other"), 100));
        assert!(!identity.matches(Path::new("/opt/omp"), 101));
        assert!(!OmpResidentBuildIdentity {
            process_started_at_ms: 99,
            ..identity
        }
        .matches(Path::new("/opt/omp"), 100));
    }

    #[test]
    fn launch_guard_rejects_disabled_or_mismatched_resident_build() {
        let flags = OmpReleaseFlags::default();
        assert_eq!(
            evaluate_launch(OmpReleasePath::App, flags, false),
            OmpRollbackGuard::reject(OmpRollbackReason::ResidentBuildMismatch)
        );
        assert_eq!(
            evaluate_launch(
                OmpReleasePath::Daemon,
                OmpReleaseFlags {
                    native: false,
                    ..flags
                },
                true,
            ),
            OmpRollbackGuard::reject(OmpRollbackReason::DisabledByFlag)
        );
        assert_eq!(
            evaluate_launch(OmpReleasePath::Daemon, flags, true),
            OmpRollbackGuard::allow()
        );
    }

    #[test]
    fn metric_contract_marks_hooked_and_unknown_states_explicitly() {
        assert_eq!(OMP_METRIC_CONTRACTS.len(), 8);
        let hooked = OMP_METRIC_CONTRACTS
            .iter()
            .filter(|contract| contract.state == OmpMetricState::Hooked)
            .count();
        let unknown = OMP_METRIC_CONTRACTS
            .iter()
            .filter(|contract| contract.state == OmpMetricState::Unknown)
            .map(|contract| contract.metric)
            .collect::<Vec<_>>();
        assert_eq!(hooked, 6);
        assert_eq!(unknown, vec![OmpMetric::ToolLatency, OmpMetric::JobLatency]);
        assert!(OMP_METRIC_CONTRACTS
            .iter()
            .all(|contract| !contract.rationale.trim().is_empty()));
        assert_eq!(OmpMetric::Startup.as_str(), "omp.startup");
        assert_eq!(OmpMetric::JobLatency.as_str(), "omp.job-latency");
    }

    /// 测试进程共享全局 recorder，omp_rpc/omp_protocol 的并行测试也会写
    /// ack/recovery/frame 计数器；本模块的指标测试串行化，独占计数器用
    /// 精确断言，共享计数器用单调断言。
    static METRICS_TEST_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    #[test]
    fn metrics_recorder_counts_events_and_surfaces_snapshot() {
        // 仓库约定（见 commands.rs OMP_TURN_INTERRUPTS）：std Mutex + expect。
        let _guard = METRICS_TEST_LOCK
            .lock()
            .expect("OMP metrics test lock poisoned");
        let before = OMP_METRICS.snapshot();
        OMP_METRICS.record_startup(std::time::Duration::from_millis(12));
        OMP_METRICS.record_ack();
        OMP_METRICS.record_first_delta(std::time::Duration::from_millis(30));
        OMP_METRICS.record_terminal_completed();
        OMP_METRICS.record_terminal_cancelled();
        OMP_METRICS.record_terminal_failed();
        OMP_METRICS.record_recovery();
        OMP_METRICS.record_frame(100);
        OMP_METRICS.record_frame(300);
        OMP_METRICS.record_frame_rejected();
        let after = OMP_METRICS.snapshot();
        assert_eq!(after.startup_count, before.startup_count + 1);
        // 共享计数器（omp_rpc 并行测试也写 ack/recovery）只断言单调递增。
        assert!(after.ack_count > before.ack_count);
        assert_eq!(after.first_delta_count, before.first_delta_count + 1);
        assert_eq!(
            after.terminal_completed_count,
            before.terminal_completed_count + 1
        );
        assert_eq!(
            after.terminal_cancelled_count,
            before.terminal_cancelled_count + 1
        );
        assert_eq!(
            after.terminal_failed_count,
            before.terminal_failed_count + 1
        );
        assert!(after.recovery_count > before.recovery_count);
        assert!(after.frame_count >= before.frame_count + 2);
        assert!(after.frame_bytes_total >= before.frame_bytes_total + 400);
        assert!(after.frame_bytes_max >= 300);
        assert!(after.frame_rejected_count > before.frame_rejected_count);
        assert!(after.startup_ms_total >= before.startup_ms_total + 12);
    }

    #[test]
    fn turn_metrics_records_first_delta_only_once_per_turn() {
        use super::super::events::EngineEvent;
        let _guard = METRICS_TEST_LOCK
            .lock()
            .expect("OMP metrics test lock poisoned");
        let before = OMP_METRICS.snapshot();
        let mut turn = OmpTurnMetrics::start();
        let text = EngineEvent::TextDelta {
            workspace_id: "ws".to_string(),
            text: "a".to_string(),
        };
        let reasoning = EngineEvent::ReasoningDelta {
            workspace_id: "ws".to_string(),
            text: "b".to_string(),
        };
        turn.observe_event(&text);
        turn.observe_event(&reasoning);
        turn.observe_event(&text);
        let after = OMP_METRICS.snapshot();
        assert_eq!(after.first_delta_count, before.first_delta_count + 1);
        turn.finish_completed();
        let after_finish = OMP_METRICS.snapshot();
        assert_eq!(
            after_finish.terminal_completed_count,
            after.terminal_completed_count + 1
        );
    }

    #[test]
    fn metrics_recorder_is_thread_safe_under_concurrent_recording() {
        // 用 terminal_completed 计数器：本模块外无并行写入者，本模块内
        // 指标测试经 METRICS_TEST_LOCK 串行，精确断言安全。
        let _guard = METRICS_TEST_LOCK
            .lock()
            .expect("OMP metrics test lock poisoned");
        let before = OMP_METRICS.snapshot();
        let mut handles = Vec::new();
        for _ in 0..4 {
            handles.push(std::thread::spawn(|| {
                for _ in 0..250 {
                    OMP_METRICS.record_terminal_completed();
                }
            }));
        }
        for handle in handles {
            handle.join().unwrap();
        }
        let after = OMP_METRICS.snapshot();
        assert_eq!(
            after.terminal_completed_count,
            before.terminal_completed_count + 1000
        );
    }

    #[test]
    fn migration_upgrades_legacy_v0_flags_envelope_and_records_from_to() {
        let legacy = serde_json::json!({"native": true, "acp": false, "rpc": true});
        let outcome = migrate_omp_persisted_state(&legacy).unwrap();
        assert_eq!(
            outcome.record,
            Some(OmpMigrationRecord {
                from: 0,
                to: OMP_PERSISTED_STATE_SCHEMA_VERSION,
            })
        );
        assert_eq!(
            outcome.state.schema_version,
            OMP_PERSISTED_STATE_SCHEMA_VERSION
        );
        assert!(outcome.state.release_flags.native);
        assert!(!outcome.state.release_flags.acp);
        assert!(outcome.state.release_flags.rpc);
        // Shared Session fail-closed 在迁移中不可被旧数据开启。
        assert!(!outcome.state.release_flags.shared_session);
    }

    #[test]
    fn migration_passes_current_version_through_without_record() {
        let state = OmpPersistedState::current(OmpReleaseFlags::default());
        let raw = serde_json::to_value(&state).unwrap();
        let outcome = migrate_omp_persisted_state(&raw).unwrap();
        assert_eq!(outcome.record, None);
        assert_eq!(outcome.state, state);
    }

    #[test]
    fn migration_fails_closed_on_unknown_version_and_malformed_payload() {
        let future = serde_json::json!({"schemaVersion": 99});
        assert!(matches!(
            migrate_omp_persisted_state(&future),
            Err(OmpMigrationError::UnknownVersion { found: 99 })
        ));
        let malformed = serde_json::json!({"schemaVersion": 1, "releaseFlags": "nope"});
        assert!(matches!(
            migrate_omp_persisted_state(&malformed),
            Err(OmpMigrationError::Malformed { .. })
        ));
    }
}
