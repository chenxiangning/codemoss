//! OMP native-session history identity and replay boundary.
//!
//! The verified OMP ACP surface exposes `session/load`, but does not expose a
//! transcript/history response schema. This module therefore provides the
//! canonical session-to-thread mapping and an explicit `unknown` loader result
//! instead of interpreting ACP notifications or control-plane frames as history.

use std::collections::HashSet;

use serde::{Deserialize, Serialize};

pub(crate) const OMP_THREAD_PREFIX: &str = "omp:";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum OmpHistoryAvailability {
    /// The local CLI evidence has not established a native transcript endpoint.
    Unknown,
    /// A future negotiated capability can explicitly reject native history.
    Unsupported,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OmpSessionBinding {
    pub(crate) native_session_id: String,
    pub(crate) logical_thread_id: String,
}

impl OmpSessionBinding {
    pub(crate) fn canonical(native_session_id: &str) -> Result<Self, String> {
        let native_session_id = normalize_native_session_id(native_session_id)?;
        Ok(Self {
            logical_thread_id: format!("{OMP_THREAD_PREFIX}{native_session_id}"),
            native_session_id,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OmpHistoryLoadResult {
    pub(crate) availability: OmpHistoryAvailability,
    pub(crate) binding: OmpSessionBinding,
    pub(crate) messages: Vec<OmpHistoryMessage>,
    pub(crate) usage_facts: Vec<OmpHistoryUsageFact>,
    pub(crate) completed_turn_ids: Vec<String>,
    pub(crate) diagnostic: String,
}

/// The currently verified ACP capability (`session/load`) only resumes a native
/// session; it does not provide a transcript. Returning this typed boundary
/// prevents a caller from treating pending ACP frames as historical messages.
pub(crate) fn load_omp_history_without_verified_endpoint(
    native_session_id: &str,
) -> Result<OmpHistoryLoadResult, String> {
    Ok(OmpHistoryLoadResult {
        availability: OmpHistoryAvailability::Unknown,
        binding: OmpSessionBinding::canonical(native_session_id)?,
        messages: Vec::new(),
        usage_facts: Vec::new(),
        completed_turn_ids: Vec::new(),
        diagnostic: "OMP native history is unknown: verified ACP capabilities include session/load but no transcript/history response schema".to_string(),
    })
}

pub(crate) fn normalize_native_session_id(value: &str) -> Result<String, String> {
    let value = value.trim();
    let native_session_id = value
        .strip_prefix(OMP_THREAD_PREFIX)
        .unwrap_or(value)
        .trim();
    if native_session_id.is_empty() {
        return Err("OMP native session id is required".to_string());
    }
    Ok(native_session_id.to_string())
}

pub(crate) fn canonical_logical_thread_id(native_session_id: &str) -> Result<String, String> {
    Ok(OmpSessionBinding::canonical(native_session_id)?.logical_thread_id)
}
/// OMP turn 事件锚定（app 与 daemon 双路径共享，禁止各自实现）。
///
/// SessionStarted 锚定调用方 thread_id：首轮 pending id 触发前端
/// pending → omp:<native> 改名。改名之后所有事件必须锚定 canonical
/// 线程 id，否则写入已删除的 phantom pending，首轮后续内容被吞
/// （2026-09-01 dev 实测）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct OmpTurnEventAnchors {
    /// SessionStarted 的锚定：bind 时已是 canonical；否则为调用方 id。
    pub(crate) session_started: String,
    /// SessionStarted 之后全部事件（TurnStarted/delta/terminal）的锚定。
    pub(crate) stream: String,
}

pub(crate) fn omp_turn_event_anchors(
    caller_thread_id: &str,
    native_session_id: &str,
    bind_thread_to_native: bool,
) -> OmpTurnEventAnchors {
    let stream = canonical_logical_thread_id(native_session_id)
        .unwrap_or_else(|_| caller_thread_id.to_string());
    let session_started = if bind_thread_to_native {
        stream.clone()
    } else {
        caller_thread_id.to_string()
    };
    OmpTurnEventAnchors {
        session_started,
        stream,
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OmpHistoryMessage {
    pub(crate) message_id: String,
    pub(crate) turn_id: Option<String>,
    pub(crate) content: String,
    pub(crate) completed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OmpHistoryUsageFact {
    pub(crate) usage_id: String,
    pub(crate) turn_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct OmpNativeHistorySnapshot {
    pub(crate) binding: OmpSessionBinding,
    pub(crate) messages: Vec<OmpHistoryMessage>,
    pub(crate) usage_facts: Vec<OmpHistoryUsageFact>,
    pub(crate) completed_turn_ids: Vec<String>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub(crate) struct OmpHistoryReplayOutcome {
    pub(crate) messages_added: usize,
    pub(crate) turns_added: usize,
    pub(crate) usage_facts_added: usize,
    pub(crate) cleanup_actions_added: usize,
}

/// Deduplicates recovery replay by the native identities that survive process
/// restart: message id, turn id, usage fact id, and terminal cleanup turn id.
/// This state deliberately has no transport knowledge; a future verified native
/// history endpoint can feed snapshots into it without widening ACP/RPC scope.
#[derive(Debug, Default)]
pub(crate) struct OmpHistoryReplayer {
    native_session_id: Option<String>,
    seen_message_ids: HashSet<String>,
    seen_turn_ids: HashSet<String>,
    seen_usage_ids: HashSet<String>,
    cleaned_turn_ids: HashSet<String>,
    messages: Vec<OmpHistoryMessage>,
}

impl OmpHistoryReplayer {
    pub(crate) fn replay(
        &mut self,
        snapshot: OmpNativeHistorySnapshot,
    ) -> Result<OmpHistoryReplayOutcome, String> {
        let snapshot_session_id = normalize_native_session_id(&snapshot.binding.native_session_id)?;
        if snapshot.binding.logical_thread_id != canonical_logical_thread_id(&snapshot_session_id)?
        {
            return Err(
                "OMP history binding does not use its canonical logical thread id".to_string(),
            );
        }
        if let Some(native_session_id) = self.native_session_id.as_deref() {
            if native_session_id != snapshot_session_id {
                return Err("OMP history replay cannot mix native sessions".to_string());
            }
        } else {
            self.native_session_id = Some(snapshot_session_id);
        }

        let mut outcome = OmpHistoryReplayOutcome::default();
        for message in snapshot.messages {
            let message_id = message.message_id.trim();
            if message_id.is_empty() {
                return Err("OMP history message id is required".to_string());
            }
            if let Some(turn_id) = message
                .turn_id
                .as_deref()
                .map(str::trim)
                .filter(|id| !id.is_empty())
            {
                if self.seen_turn_ids.insert(turn_id.to_string()) {
                    outcome.turns_added += 1;
                }
                if message.completed && self.cleaned_turn_ids.insert(turn_id.to_string()) {
                    outcome.cleanup_actions_added += 1;
                }
            }
            if self.seen_message_ids.insert(message_id.to_string()) {
                self.messages.push(message);
                outcome.messages_added += 1;
            }
        }
        for usage in snapshot.usage_facts {
            let usage_id = usage.usage_id.trim();
            if usage_id.is_empty() {
                return Err("OMP history usage fact id is required".to_string());
            }
            if let Some(turn_id) = usage
                .turn_id
                .as_deref()
                .map(str::trim)
                .filter(|id| !id.is_empty())
            {
                if self.seen_turn_ids.insert(turn_id.to_string()) {
                    outcome.turns_added += 1;
                }
            }
            if self.seen_usage_ids.insert(usage_id.to_string()) {
                outcome.usage_facts_added += 1;
            }
        }
        for turn_id in snapshot.completed_turn_ids {
            let turn_id = turn_id.trim();
            if turn_id.is_empty() {
                return Err("OMP completed history turn id is required".to_string());
            }
            if self.seen_turn_ids.insert(turn_id.to_string()) {
                outcome.turns_added += 1;
            }
            if self.cleaned_turn_ids.insert(turn_id.to_string()) {
                outcome.cleanup_actions_added += 1;
            }
        }
        Ok(outcome)
    }

    #[cfg(test)]
    fn messages(&self) -> &[OmpHistoryMessage] {
        &self.messages
    }
}

#[cfg(test)]
mod tests {
    use super::{
        canonical_logical_thread_id, load_omp_history_without_verified_endpoint,
        OmpHistoryAvailability, OmpHistoryMessage, OmpHistoryReplayer, OmpHistoryUsageFact,
        OmpNativeHistorySnapshot, OmpSessionBinding,
    };
    use super::omp_turn_event_anchors;

    #[test]
    fn turn_event_anchors_switch_to_canonical_after_session_started() {
        // 首轮：pending 触发改名，之后锚定 canonical，事件不被吞
        let anchors = omp_turn_event_anchors("omp-pending-turn-1", "native-1", false);
        assert_eq!(anchors.session_started, "omp-pending-turn-1");
        assert_eq!(anchors.stream, "omp:native-1");

        // 后续轮：调用方已是 canonical，两个锚点一致
        let resumed = omp_turn_event_anchors("omp:native-1", "native-1", false);
        assert_eq!(resumed.session_started, "omp:native-1");
        assert_eq!(resumed.stream, "omp:native-1");

        // bind 路径：无前端 pending，SessionStarted 也锚定 canonical
        let bound = omp_turn_event_anchors("omp-pending-turn-2", "native-2", true);
        assert_eq!(bound.session_started, "omp:native-2");
        assert_eq!(bound.stream, "omp:native-2");
    }

    fn snapshot() -> OmpNativeHistorySnapshot {
        OmpNativeHistorySnapshot {
            binding: OmpSessionBinding::canonical("native-session-1").unwrap(),
            messages: vec![OmpHistoryMessage {
                message_id: "message-1".to_string(),
                turn_id: Some("turn-1".to_string()),
                content: "completed response".to_string(),
                completed: true,
            }],
            usage_facts: vec![OmpHistoryUsageFact {
                usage_id: "usage-1".to_string(),
                turn_id: Some("turn-1".to_string()),
            }],
            completed_turn_ids: vec!["turn-1".to_string()],
        }
    }

    #[test]
    fn resume_mapping_normalizes_raw_and_canonical_session_ids() {
        assert_eq!(
            canonical_logical_thread_id("native-session-1").unwrap(),
            "omp:native-session-1"
        );
        assert_eq!(
            canonical_logical_thread_id("omp:native-session-1").unwrap(),
            "omp:native-session-1"
        );
    }

    #[test]
    fn unverified_history_endpoint_returns_explicit_unknown_without_messages() {
        let result = load_omp_history_without_verified_endpoint("omp:native-session-1").unwrap();
        assert_eq!(result.availability, OmpHistoryAvailability::Unknown);
        assert_eq!(result.binding.logical_thread_id, "omp:native-session-1");
        assert!(result.messages.is_empty());
        assert!(result.usage_facts.is_empty());
        assert!(result.completed_turn_ids.is_empty());
    }

    #[test]
    fn duplicate_recovery_replay_does_not_duplicate_messages_turns_usage_or_cleanup() {
        let mut replayer = OmpHistoryReplayer::default();
        let first = replayer.replay(snapshot()).unwrap();
        let duplicate = replayer.replay(snapshot()).unwrap();

        assert_eq!(first.messages_added, 1);
        assert_eq!(first.turns_added, 1);
        assert_eq!(first.usage_facts_added, 1);
        assert_eq!(first.cleanup_actions_added, 1);
        assert_eq!(duplicate.messages_added, 0);
        assert_eq!(duplicate.turns_added, 0);
        assert_eq!(duplicate.usage_facts_added, 0);
        assert_eq!(duplicate.cleanup_actions_added, 0);
        assert_eq!(replayer.messages().len(), 1);
        assert_eq!(replayer.messages()[0].message_id, "message-1");
    }

    #[test]
    fn replay_rejects_a_snapshot_for_another_native_session() {
        let mut replayer = OmpHistoryReplayer::default();
        replayer.replay(snapshot()).unwrap();
        let mut other = snapshot();
        other.binding = OmpSessionBinding::canonical("native-session-2").unwrap();
        assert!(replayer.replay(other).is_err());
    }
}
