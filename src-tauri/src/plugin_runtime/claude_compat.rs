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

    pub async fn interrupt_workspace_sessions(&self, workspace_id: &str) -> Result<(), String> {
        self.manager.interrupt_workspace_sessions(workspace_id).await
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
