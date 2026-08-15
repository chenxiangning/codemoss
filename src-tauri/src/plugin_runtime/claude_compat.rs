//! Wave 3D: single-owner Claude facade. Delegates to Core; does not replace registry.

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

/// 3D 只允许 Core owner。第二个变体留给 3E flag，不得在本刀出现。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompatOwner {
    CoreClaude,
}

pub struct ClaudeCompatAdapter {
    owner: CompatOwner,
    plugin_id: String,
    manager: ClaudeSessionManager,
    builtin: BuiltinEngineAdapter,
}

impl ClaudeCompatAdapter {
    pub fn core() -> Self {
        Self {
            owner: CompatOwner::CoreClaude,
            plugin_id: CLAUDE_PLUGIN_ID.to_string(),
            manager: ClaudeSessionManager::new(),
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

    pub async fn get_or_create_session(
        &self,
        workspace_id: &str,
        workspace_path: &Path,
    ) -> Arc<ClaudeSession> {
        self.manager
            .get_or_create_session(workspace_id, workspace_path)
            .await
    }

    pub fn map_wire_event(&self, payload: serde_json::Value) -> Result<EngineEvent, String> {
        self.builtin.map_wire_event(payload)
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

    #[tokio::test]
    async fn facade_shares_the_core_session_manager() {
        let adapter = ClaudeCompatAdapter::core();
        let workspace = std::env::temp_dir().join("mossx-claude-compat-ws");
        let first = adapter.get_or_create_session("ws-compat", &workspace).await;
        let second = adapter.get_or_create_session("ws-compat", &workspace).await;
        assert!(Arc::ptr_eq(&first, &second));
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
