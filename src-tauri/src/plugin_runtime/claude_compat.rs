//! Wave 3D/3E: single-owner Claude facade. Delegates to Core; does not replace registry.

use std::ffi::OsStr;
use std::path::Path;
use std::sync::Arc;

use crate::engine::adapter_registry::{
    BuiltinEngineAdapter, EngineAdapter, EngineAdapterRegistry, EngineId,
};
use crate::engine::claude::{ClaudeSession, ClaudeSessionManager};
use crate::engine::events::EngineEvent;
use crate::engine::EngineType;

use super::claude_pilot::claude_activation_request;

pub const CLAUDE_PLUGIN_ID: &str = "com.mossx.engine.claude";
pub const CLAUDE_COMPAT_FACADE_ENV: &str = "MOSSX_CLAUDE_COMPAT_FACADE";

/// 只允许 Core owner。flag 切的是调用路径，不是第二个实现。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompatOwner {
    CoreClaude,
}

pub struct ClaudeCompatAdapter {
    owner: CompatOwner,
    plugin_id: String,
    manager: Arc<ClaudeSessionManager>,
    builtin: BuiltinEngineAdapter,
}

pub fn claude_compat_facade_enabled() -> bool {
    claude_compat_facade_enabled_from(std::env::var_os(CLAUDE_COMPAT_FACADE_ENV).as_deref())
}

pub fn claude_compat_facade_enabled_from(value: Option<&OsStr>) -> bool {
    matches!(
        value.and_then(OsStr::to_str).map(str::trim),
        Some("1" | "true" | "TRUE" | "yes")
    )
}

impl ClaudeCompatAdapter {
    pub fn core() -> Self {
        Self::wrapping(Arc::new(ClaudeSessionManager::new()))
    }

    pub fn wrapping(manager: Arc<ClaudeSessionManager>) -> Self {
        Self {
            owner: CompatOwner::CoreClaude,
            plugin_id: CLAUDE_PLUGIN_ID.to_string(),
            manager,
            builtin: BuiltinEngineAdapter::new(EngineType::Claude),
        }
    }

    pub fn owner(&self) -> CompatOwner {
        self.owner
    }

    pub fn plugin_id(&self) -> &str {
        &self.plugin_id
    }

    pub fn engine_id(&self) -> &str {
        self.builtin.engine_id().as_str()
    }

    pub fn manager(&self) -> &Arc<ClaudeSessionManager> {
        &self.manager
    }

    pub async fn get_or_create_session(
        &self,
        workspace_id: &str,
        workspace_path: &Path,
    ) -> Arc<ClaudeSession> {
        self.manager
            .get_or_create_session(workspace_id, workspace_path)
            .await
    }

    pub async fn get_or_create_session_for_provider(
        &self,
        workspace_id: &str,
        workspace_path: &Path,
        provider_profile_id: Option<&str>,
    ) -> Arc<ClaudeSession> {
        self.manager
            .get_or_create_session_for_provider(workspace_id, workspace_path, provider_profile_id)
            .await
    }

    pub fn map_wire_event(&self, payload: serde_json::Value) -> Result<EngineEvent, String> {
        self.builtin.map_wire_event(payload)
    }

    pub async fn get_session_for_provider(
        &self,
        workspace_id: &str,
        provider_profile_id: Option<&str>,
    ) -> Option<Arc<ClaudeSession>> {
        self.manager
            .get_session_for_provider(workspace_id, provider_profile_id)
            .await
    }

    pub async fn session_for_turn(
        &self,
        workspace_id: &str,
        turn_id: &str,
    ) -> Option<Arc<ClaudeSession>> {
        self.manager.session_for_turn(workspace_id, turn_id).await
    }

    pub async fn sessions_for_workspace(&self, workspace_id: &str) -> Vec<Arc<ClaudeSession>> {
        self.manager.sessions_for_workspace(workspace_id).await
    }

    pub async fn runtime_sessions_for_workspace(
        &self,
        workspace_id: &str,
    ) -> Vec<(String, Arc<ClaudeSession>)> {
        self.manager
            .runtime_sessions_for_workspace(workspace_id)
            .await
    }

    pub async fn remove_runtime_session(&self, runtime_key: &str) -> Option<Arc<ClaudeSession>> {
        self.manager.remove_runtime_session(runtime_key).await
    }

    pub async fn interrupt_workspace_sessions(&self, workspace_id: &str) -> Result<(), String> {
        self.manager.interrupt_workspace_sessions(workspace_id).await
    }

    pub async fn list_sessions(&self) -> Vec<(String, Arc<ClaudeSession>)> {
        self.manager.list_sessions().await
    }

    pub async fn interrupt_all(&self) {
        self.manager.interrupt_all().await
    }

    pub fn ask_lookup(&self) -> crate::engine::claude::ClaudeAskLookup {
        crate::engine::claude::ClaudeAskLookup::from_manager(self.manager.clone())
    }

    pub async fn remove_workspace_sessions(&self, workspace_id: &str) {
        for (runtime_key, session) in self.manager.runtime_sessions_for_workspace(workspace_id).await
        {
            if let Err(error) = session.interrupt().await {
                log::warn!(
                    "[claude_compat] failed to interrupt claude session during remove (workspace={}): {}",
                    workspace_id,
                    error
                );
                continue;
            }
            session.mark_disposed();
            self.manager.remove_runtime_session(&runtime_key).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn facade_identity_matches_claude_fixture() {
        let adapter = ClaudeCompatAdapter::core();
        assert_eq!(adapter.plugin_id(), claude_activation_request().plugin_id);
        assert_eq!(adapter.plugin_id(), CLAUDE_PLUGIN_ID);
        assert_eq!(adapter.engine_id(), "claude");
        assert_eq!(adapter.owner(), CompatOwner::CoreClaude);
    }

    #[test]
    fn flag_defaults_to_off() {
        assert!(!claude_compat_facade_enabled_from(None));
        assert!(!claude_compat_facade_enabled_from(Some(OsStr::new("0"))));
        assert!(!claude_compat_facade_enabled_from(Some(OsStr::new("false"))));
        assert!(claude_compat_facade_enabled_from(Some(OsStr::new("1"))));
        assert!(claude_compat_facade_enabled_from(Some(OsStr::new("true"))));
    }

    #[tokio::test]
    async fn facade_shares_the_core_session_manager() {
        let manager = Arc::new(ClaudeSessionManager::new());
        let adapter = ClaudeCompatAdapter::wrapping(manager.clone());
        let workspace = std::env::temp_dir().join("mossx-claude-compat-ws");
        let first = adapter.get_or_create_session("ws-compat", &workspace).await;
        let second = manager
            .get_or_create_session("ws-compat", &workspace)
            .await;
        assert!(Arc::ptr_eq(&first, &second));
        assert!(Arc::ptr_eq(adapter.manager(), &manager));
        let looked_up = adapter
            .get_session_for_provider("ws-compat", None)
            .await
            .expect("lookup");
        assert!(Arc::ptr_eq(&first, &looked_up));
    }

    #[test]
    fn product_interrupt_goes_through_the_manager_entry() {
        let commands = include_str!("../engine/commands.rs");
        let daemon = include_str!("../bin/cc_gui_daemon/daemon_state.rs");
        let commands_interrupt = commands
            .split("pub async fn engine_interrupt(")
            .nth(1)
            .and_then(|rest| rest.split("pub async fn engine_interrupt_turn(").next())
            .expect("engine_interrupt");
        let daemon_interrupt = daemon
            .split("pub(super) async fn engine_interrupt(")
            .nth(1)
            .and_then(|rest| rest.split("pub(super) async fn engine_interrupt_turn(").next())
            .expect("daemon engine_interrupt");
        assert!(commands_interrupt.contains("interrupt_claude_sessions"));
        assert!(!commands_interrupt.contains("claude_manager"));
        assert!(daemon_interrupt.contains("interrupt_claude_sessions"));
        assert!(!daemon_interrupt.contains("claude_manager"));
    }

    #[test]
    fn product_turn_interrupt_goes_through_the_manager_entry() {
        let commands = include_str!("../engine/commands.rs");
        let daemon = include_str!("../bin/cc_gui_daemon/daemon_state.rs");
        let commands_turn = commands
            .split("pub async fn engine_interrupt_turn(")
            .nth(1)
            .and_then(|rest| rest.split("EngineType::Codex =>").next())
            .expect("engine_interrupt_turn");
        let daemon_turn = daemon
            .split("pub(super) async fn engine_interrupt_turn(")
            .nth(1)
            .and_then(|rest| rest.split("engine::EngineType::Codex =>").next())
            .expect("daemon engine_interrupt_turn");
        assert!(commands_turn.contains("interrupt_claude_turn"));
        assert!(!commands_turn.contains("claude_manager"));
        assert!(daemon_turn.contains("interrupt_claude_turn"));
        assert!(!daemon_turn.contains("claude_manager"));
    }

    #[test]
    fn product_shutdown_and_list_go_through_the_manager_entry() {
        let lib = include_str!("../lib.rs");
        let daemon = include_str!("../bin/cc_gui_daemon.rs");
        let runtime = include_str!("../runtime/mod.rs");
        let commands = include_str!("../engine/commands.rs");
        assert!(lib.contains("interrupt_all_claude_sessions"));
        assert!(!lib.contains("claude_manager.interrupt_all"));
        assert!(daemon.contains("interrupt_all_claude_sessions"));
        assert!(!daemon.contains("claude_manager.interrupt_all"));
        assert!(runtime.contains("list_claude_sessions"));
        assert!(!runtime.contains("claude_manager.list_sessions"));
        assert!(commands.contains("list_claude_sessions"));
        assert!(!commands.contains("claude_manager.list_sessions"));
    }

    #[test]
    fn remaining_lookups_go_through_the_manager_entry() {
        let shared = include_str!("../shared_session_v2.rs");
        let lifecycle = include_str!("../runtime/session_lifecycle.rs");
        let state = include_str!("../state.rs");
        assert!(shared.contains("get_claude_session_if_present"));
        assert!(!shared.contains("claude_manager"));
        assert!(lifecycle.contains("claude_runtime_sessions_for_workspace"));
        assert!(lifecycle.contains("remove_claude_runtime_session"));
        assert!(!lifecycle.contains("claude_manager"));
        assert!(state.contains("list_claude_sessions"));
        assert!(!state.contains("claude_manager.list_sessions"));
    }

    #[test]
    fn control_responses_go_through_the_manager_entry() {
        let codex = include_str!("../codex/mod.rs");
        let daemon = include_str!("../bin/cc_gui_daemon/daemon_state.rs");
        let shared = codex
            .split("async fn respond_to_shared_control_request(")
            .nth(1)
            .and_then(|rest| rest.split("pub(crate) async fn respond_to_server_request(").next())
            .expect("shared control");
        let native = codex
            .split("// Native control request keeps the existing request-id routing contract.")
            .nth(1)
            .expect("native control");
        let daemon_respond = daemon
            .split("pub(super) async fn respond_to_server_request(")
            .nth(1)
            .expect("daemon respond");
        assert!(shared.contains("get_claude_session_if_present"));
        assert!(!shared.contains("claude_manager"));
        assert!(native.contains("claude_sessions_for_workspace"));
        assert!(!native.contains("claude_manager"));
        assert!(daemon_respond.contains("claude_sessions_for_workspace"));
        assert!(!daemon_respond.contains("claude_manager"));
    }

    #[test]
    fn askuser_boot_goes_through_the_manager_entry() {
        let lib = include_str!("../lib.rs");
        let state = include_str!("../state.rs");
        let mcp = include_str!("../engine/claude/askuser_mcp.rs");
        assert!(lib.contains("claude_ask_lookup"));
        assert!(!lib.contains("claude_manager.clone"));
        assert!(state.contains("set_claude_ask_user_question_resume_diagnostic_sink"));
        assert!(!state.contains("claude_manager.set_ask_user_question_resume_diagnostic_sink"));
        assert!(mcp.contains("lookup.get_session"));
        assert!(!mcp.contains("claude_manager.get_session"));
    }

    #[tokio::test]
    async fn facade_remove_clears_the_core_session_table() {
        let manager = Arc::new(ClaudeSessionManager::new());
        let adapter = ClaudeCompatAdapter::wrapping(manager.clone());
        let workspace = std::env::temp_dir().join("mossx-claude-compat-remove-ws");
        let _session = adapter.get_or_create_session("ws-remove", &workspace).await;
        assert!(manager.get_session("ws-remove").await.is_some());
        adapter.remove_workspace_sessions("ws-remove").await;
        assert!(manager.get_session("ws-remove").await.is_none());
    }

    #[test]
    fn production_registry_stays_builtin() {
        let registry = EngineAdapterRegistry::with_builtins();
        let id = EngineId::builtin(EngineType::Claude);
        let entry = registry.get(&id).expect("claude builtin");
        assert_eq!(entry.adapter_id, "builtin.claude");
        match &entry.source {
            crate::engine::adapter_registry::EngineSourceInfo::Builtin { .. } => {}
            other => panic!("expected builtin source, got {other:?}"),
        }
        assert_eq!(registry.len(), 7);
    }

    #[test]
    fn facade_maps_wire_events_through_builtin_adapter() {
        let adapter = ClaudeCompatAdapter::core();
        let event = adapter
            .map_wire_event(serde_json::json!({
                "workspaceId": "workspace-1",
                "type": "assistant"
            }))
            .expect("mapped");
        assert!(matches!(
            event,
            EngineEvent::Raw {
                engine: EngineType::Claude,
                ..
            }
        ));
    }
}
