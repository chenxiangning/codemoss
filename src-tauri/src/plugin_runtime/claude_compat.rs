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

#[derive(Clone)]
pub struct ClaudeCompatAdapter {
    owner: CompatOwner,
    plugin_id: String,
    manager: Arc<ClaudeSessionManager>,
    builtin: BuiltinEngineAdapter,
}

#[derive(Clone)]
pub struct OwnedClaudeHistory {
    facade: Option<ClaudeCompatAdapter>,
    config: Option<crate::engine::EngineConfig>,
}

impl OwnedClaudeHistory {
    pub fn new(
        facade: Option<ClaudeCompatAdapter>,
        config: Option<crate::engine::EngineConfig>,
    ) -> Self {
        Self { facade, config }
    }

    pub fn uses_facade(&self) -> bool {
        self.facade.is_some()
    }

    pub async fn delete_session(
        &self,
        workspace_path: &Path,
        session_id: &str,
    ) -> Result<(), String> {
        match &self.facade {
            Some(facade) => {
                facade
                    .delete_history_session(workspace_path, session_id, self.config.as_ref())
                    .await
            }
            None => {
                crate::engine::claude_history::delete_claude_session_with_config(
                    workspace_path,
                    session_id,
                    self.config.as_ref(),
                )
                .await
            }
        }
    }
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

    pub async fn set_config(&self, config: crate::engine::EngineConfig) {
        self.manager.set_config(config).await
    }

    pub async fn remove_workspace_sessions(&self, workspace_id: &str) {
        self.manager.remove_workspace_sessions(workspace_id).await
    }

    pub async fn list_history_sessions(
        &self,
        workspace_path: &Path,
        limit: Option<usize>,
        config: Option<&crate::engine::EngineConfig>,
    ) -> Result<Vec<crate::engine::claude_history::ClaudeSessionSummary>, String> {
        crate::engine::claude_history::list_claude_sessions_with_config(
            workspace_path,
            limit,
            config,
        )
        .await
    }

    pub async fn load_history_session(
        &self,
        workspace_path: &Path,
        session_id: &str,
        config: Option<&crate::engine::EngineConfig>,
        limit: Option<usize>,
        before: Option<&str>,
    ) -> Result<crate::engine::claude_history::ClaudeSessionLoadResult, String> {
        crate::engine::claude_history::load_claude_session_with_config_window(
            workspace_path,
            session_id,
            config,
            limit,
            before,
        )
        .await
    }

    pub async fn hydrate_history_image(
        &self,
        workspace_path: &Path,
        locator: crate::engine::claude_history::ClaudeDeferredImageLocator,
        config: Option<&crate::engine::EngineConfig>,
    ) -> Result<crate::engine::claude_history::ClaudeHydratedImage, String> {
        crate::engine::claude_history::hydrate_claude_deferred_image_with_config(
            workspace_path,
            locator,
            config,
        )
        .await
    }

    pub async fn fork_history_session(
        &self,
        workspace_path: &Path,
        session_id: &str,
        config: Option<&crate::engine::EngineConfig>,
    ) -> Result<String, String> {
        crate::engine::claude_history::fork_claude_session_with_config(
            workspace_path,
            session_id,
            config,
        )
        .await
    }

    pub async fn delete_history_session(
        &self,
        workspace_path: &Path,
        session_id: &str,
        config: Option<&crate::engine::EngineConfig>,
    ) -> Result<(), String> {
        crate::engine::claude_history::delete_claude_session_with_config(
            workspace_path,
            session_id,
            config,
        )
        .await
    }

    pub async fn fork_history_session_from_message(
        &self,
        workspace_path: &Path,
        session_id: &str,
        message_id: &str,
        config: Option<&crate::engine::EngineConfig>,
    ) -> Result<String, String> {
        crate::engine::claude_history::fork_claude_session_from_message_with_config(
            workspace_path,
            session_id,
            message_id,
            config,
        )
        .await
    }

    pub async fn list_history_sessions_for_attribution_scopes(
        &self,
        workspace_path: &Path,
        attribution_scopes: Vec<crate::engine::claude_history::ClaudeSessionAttributionScope>,
        limit: Option<usize>,
        config: Option<&crate::engine::EngineConfig>,
    ) -> Result<Vec<crate::engine::claude_history::ClaudeSessionSummary>, String> {
        crate::engine::claude_history::list_claude_sessions_for_attribution_scopes_with_config(
            workspace_path,
            attribution_scopes,
            limit,
            config,
        )
        .await
    }

    pub async fn list_history_source_facts_for_attribution_scopes(
        &self,
        workspace_path: &Path,
        attribution_scopes: Vec<crate::engine::claude_history::ClaudeSessionAttributionScope>,
        limit: Option<usize>,
        config: Option<&crate::engine::EngineConfig>,
        cache_dir: Option<&Path>,
    ) -> Result<crate::engine::claude_history::ClaudeSessionSourceFactList, String> {
        crate::engine::claude_history::list_claude_session_source_facts_for_attribution_scopes_with_config(
            workspace_path,
            attribution_scopes,
            limit,
            config,
            cache_dir,
        )
        .await
    }

    pub async fn list_workspace_only_history_source_facts_for_attribution_scopes(
        &self,
        workspace_path: &Path,
        attribution_scopes: Vec<crate::engine::claude_history::ClaudeSessionAttributionScope>,
        limit: Option<usize>,
        config: Option<&crate::engine::EngineConfig>,
        cache_dir: Option<&Path>,
    ) -> Result<crate::engine::claude_history::ClaudeSessionSourceFactList, String> {
        crate::engine::claude_history::list_workspace_only_claude_session_source_facts_for_attribution_scopes_with_config(
            workspace_path,
            attribution_scopes,
            limit,
            config,
            cache_dir,
        )
        .await
    }

    pub fn resolve_history_session_file(
        &self,
        workspace_path: &Path,
        session_id: &str,
        config: Option<&crate::engine::EngineConfig>,
    ) -> Result<std::path::PathBuf, String> {
        crate::engine::claude_history::resolve_claude_session_file_with_config(
            workspace_path,
            session_id,
            config,
        )
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
    fn transitional_package_manifest_shares_identity_with_fixture() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../../packages/plugin-contract/fixtures/valid/claude-engine.json"
        ))
        .expect("3B fixture");
        let package: serde_json::Value = serde_json::from_str(include_str!(
            "../../../packages/plugin-engine-claude/.mossx-plugin/plugin.json"
        ))
        .expect("3AK package");
        for key in [
            "pluginId",
            "version",
            "entries",
            "activationUnits",
            "contributions",
            "capabilities",
            "compatibility",
            "budgets",
        ] {
            assert_eq!(package.get(key), fixture.get(key), "{key}");
        }
        assert_eq!(package["pluginId"], "com.mossx.engine.claude");
        assert_ne!(package.get("description"), fixture.get("description"));
        let boot = include_str!("boot.rs");
        assert!(!boot.contains("plugin-engine-claude"));
        assert!(std::path::Path::new("src/engine/claude.rs").exists());
        let disable_inventory = include_str!(
            "../../../docs/architecture/plugin-platform/inventory/claude-disable-not-delete.json"
        );
        assert!(disable_inventory.contains("fixtureDisable"));
        assert!(disable_inventory.contains("stillCoreClaude"));
        assert!(disable_inventory.contains("flagDefault"));
        let pilot = include_str!("claude_pilot.rs");
        assert!(pilot.contains("fn disable_claude_fixture_keeps_core_implementation"));
        assert!(pilot.contains("host.disable(\"com.mossx.engine.claude\")"));
        assert!(!boot.contains("disable(\"com.mossx.engine.claude\")"));
        assert!(!claude_compat_facade_enabled_from(None));
        let close = include_str!(
            "../../../docs/architecture/plugin-platform/inventory/claude-dual-run-close.json"
        );
        assert!(close.contains("\"3_adapter\": \"done\""));
        assert!(close.contains("\"5_dualRun\": \"default-off-call-path-done\""));
        assert!(close.contains("\"7_disable\": \"fixture-only\""));
        assert!(close.contains("\"8_slim\": \"forbidden\""));
        assert!(close.contains("delete engine/claude*"));
        assert!(std::path::Path::new("src/engine/claude.rs").exists());
        let gaps = include_str!(
            "../../../docs/architecture/plugin-platform/inventory/claude-conformance-gaps.json"
        );
        assert!(gaps.contains("\"interrupt\""));
        assert!(gaps.contains("call-path-done"));
        assert!(gaps.contains("missing-product-acceptance"));
        assert!(gaps.contains("firstInteractive"));
        assert!(gaps.contains("treat call-path asserts as product conformance"));
        let boot_inventory = include_str!(
            "../../../docs/architecture/plugin-platform/inventory/claude-product-boot-default-off.json"
        );
        assert!(boot_inventory.contains("EngineManager::new()"));
        assert!(boot_inventory.contains("\"default\": \"off\""));
        assert!(boot_inventory.contains("new_with_claude_compat(true)"));
        let state = include_str!("../state.rs");
        assert!(state.contains("EngineManager::new()"));
        assert!(!state.contains("new_with_claude_compat(true)"));
        let daemon_ctor = include_str!("../bin/cc_gui_daemon/daemon_state.rs");
        assert!(daemon_ctor.contains("engine::EngineManager::new()"));
        assert!(!daemon_ctor.contains("new_with_claude_compat(true)"));
        let manager_new = include_str!("../engine/manager.rs")
            .split("pub fn new() -> Self {")
            .nth(1)
            .and_then(|rest| rest.split("pub fn new_with_claude_compat(").next())
            .expect("EngineManager::new");
        assert!(manager_new.contains("claude_compat_facade_enabled()"));
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

    #[test]
    fn product_modules_cannot_touch_the_claude_manager_field() {
        let files = [
            include_str!("../lib.rs"),
            include_str!("../state.rs"),
            include_str!("../engine/commands.rs"),
            include_str!("../bin/cc_gui_daemon.rs"),
            include_str!("../bin/cc_gui_daemon/daemon_state.rs"),
            include_str!("../runtime/mod.rs"),
            include_str!("../runtime/session_lifecycle.rs"),
            include_str!("../shared_session_v2.rs"),
            include_str!("../codex/mod.rs"),
        ];
        for source in files {
            assert!(
                !source.contains(".claude_manager"),
                "product module still touches .claude_manager"
            );
        }
        let manager = include_str!("../engine/manager.rs");
        assert!(manager.contains("    claude_manager: Arc<ClaudeSessionManager>,"));
        assert!(!manager.contains("    pub claude_manager:"));
        assert!(manager.contains("facade.set_config"));
        assert!(manager.contains("fn core_claude("));
        let method_calls = manager.matches("self.claude_manager.").count();
        assert_eq!(
            method_calls, 0,
            "flag-off paths must not call methods on self.claude_manager"
        );
        assert!(manager.contains("fn claude_owner("));
        assert!(manager.contains("self.claude_owner()"));
        let get_session = manager
            .split("pub async fn get_claude_session(")
            .nth(1)
            .and_then(|rest| rest.split("pub async fn get_claude_session_for_provider(").next())
            .expect("get_claude_session");
        assert!(get_session.contains("claude_owner()"));
        assert!(!get_session.contains("if let Some(facade)"));
        let remove = manager
            .split("pub async fn remove_claude_session(")
            .nth(1)
            .and_then(|rest| rest.split("pub async fn interrupt_claude_sessions(").next())
            .expect("remove_claude_session");
        assert!(remove.contains("claude_owner()"));
        assert!(!remove.contains("if let Some(facade)"));
        let interrupt = manager
            .split("pub async fn interrupt_claude_sessions(")
            .nth(1)
            .and_then(|rest| rest.split("pub async fn interrupt_claude_turn(").next())
            .expect("interrupt_claude_sessions");
        assert!(interrupt.contains("claude_owner()"));
        assert!(!interrupt.contains("if let Some(facade)"));
    }

    #[test]
    fn history_inventory_lists_product_call_sites_without_deleting_implementation() {
        let inventory = include_str!(
            "../../../docs/architecture/plugin-platform/inventory/claude-history.json"
        );
        assert!(inventory.contains("session_history_commands.rs#list_claude_sessions"));
        assert!(inventory.contains("daemon_state.rs#list_claude_sessions"));
        assert!(inventory.contains("session_management.rs"));
        assert!(inventory.contains("native_continuation/commands.rs"));
        assert!(inventory.contains("claudeHistoryLoader.ts"));
        assert!(inventory.contains("geminiHistoryParser.ts"));
        assert!(std::path::Path::new("src/engine/claude_history.rs").exists());
        let history = include_str!("../engine/session_history_commands.rs");
        assert!(history.contains("list_claude_history_sessions"));
        let list_fn = history
            .split("pub async fn list_claude_sessions(")
            .nth(1)
            .and_then(|rest| rest.split("pub async fn load_claude_session(").next())
            .expect("list_claude_sessions");
        assert!(list_fn.contains("list_claude_history_sessions"));
        assert!(!list_fn.contains("claude_history::"));
        let manager = include_str!("../engine/manager.rs");
        assert!(manager.contains("fn list_claude_history_sessions("));
        assert!(manager.contains("list_history_sessions"));
        assert!(history.contains("load_claude_history_session"));
        let load_fn = history
            .split("pub async fn load_claude_session(")
            .nth(1)
            .and_then(|rest| rest.split("pub async fn hydrate_claude_deferred_image(").next())
            .expect("load_claude_session");
        assert!(load_fn.contains("load_claude_history_session"));
        assert!(!load_fn.contains("claude_history::"));
        assert!(manager.contains("fn load_claude_history_session("));
        assert!(manager.contains("load_history_session"));
        assert!(history.contains("hydrate_claude_history_image"));
        let hydrate_fn = history
            .split("pub async fn hydrate_claude_deferred_image(")
            .nth(1)
            .and_then(|rest| rest.split("pub async fn fork_claude_session(").next())
            .expect("hydrate_claude_deferred_image");
        assert!(hydrate_fn.contains("hydrate_claude_history_image"));
        assert!(!hydrate_fn.contains("claude_history::"));
        assert!(manager.contains("fn hydrate_claude_history_image("));
        assert!(manager.contains("hydrate_history_image"));
        assert!(history.contains("fork_claude_history_session"));
        let fork_fn = history
            .split("pub async fn fork_claude_session(")
            .nth(1)
            .and_then(|rest| rest.split("pub async fn delete_claude_session(").next())
            .expect("fork_claude_session");
        assert!(fork_fn.contains("fork_claude_history_session"));
        assert!(!fork_fn.contains("claude_history::"));
        assert!(manager.contains("fn fork_claude_history_session("));
        assert!(manager.contains("fork_history_session"));
        assert!(history.contains("delete_claude_history_session"));
        let delete_fn = history
            .split("pub async fn delete_claude_session(")
            .nth(1)
            .and_then(|rest| rest.split("pub async fn list_gemini_sessions(").next())
            .expect("delete_claude_session");
        assert!(delete_fn.contains("delete_claude_history_session"));
        assert!(!delete_fn.contains("claude_history::"));
        assert!(manager.contains("fn delete_claude_history_session("));
        assert!(manager.contains("delete_history_session"));
        let rewind = include_str!("../engine/rewind_commands.rs");
        assert!(rewind.contains("fork_claude_history_session_from_message"));
        let rewind_fn = rewind
            .split("pub async fn fork_claude_session_from_message(")
            .nth(1)
            .expect("fork_claude_session_from_message");
        assert!(rewind_fn.contains("fork_claude_history_session_from_message"));
        assert!(!rewind_fn.contains("claude_history::"));
        assert!(manager.contains("fn fork_claude_history_session_from_message("));
        assert!(manager.contains("fork_history_session_from_message"));
        let daemon = include_str!("../bin/cc_gui_daemon/daemon_state.rs");
        let daemon_list = daemon
            .split("pub(super) async fn list_claude_sessions(")
            .nth(1)
            .and_then(|rest| rest.split("pub(super) async fn load_claude_session(").next())
            .expect("daemon list_claude_sessions");
        assert!(daemon_list.contains("list_claude_history_sessions"));
        assert!(!daemon_list.contains("claude_history::"));
        let daemon_load = daemon
            .split("pub(super) async fn load_claude_session(")
            .nth(1)
            .and_then(|rest| rest.split("pub(super) async fn load_codex_session(").next())
            .expect("daemon load_claude_session");
        assert!(daemon_load.contains("load_claude_history_session"));
        assert!(!daemon_load.contains("claude_history::"));
        let daemon_hydrate = daemon
            .split("pub(super) async fn hydrate_claude_deferred_image(")
            .nth(1)
            .and_then(|rest| rest.split("pub(super) async fn fork_claude_session(").next())
            .expect("daemon hydrate_claude_deferred_image");
        assert!(daemon_hydrate.contains("hydrate_claude_history_image"));
        assert!(!daemon_hydrate.contains("claude_history::"));
        let daemon_fork = daemon
            .split("pub(super) async fn fork_claude_session(")
            .nth(1)
            .and_then(|rest| rest.split("pub(super) async fn fork_claude_session_from_message(").next())
            .expect("daemon fork_claude_session");
        assert!(daemon_fork.contains("fork_claude_history_session"));
        assert!(!daemon_fork.contains("claude_history::"));
        let daemon_rewind = daemon
            .split("pub(super) async fn fork_claude_session_from_message(")
            .nth(1)
            .and_then(|rest| rest.split("pub(super) async fn delete_claude_session(").next())
            .expect("daemon fork_claude_session_from_message");
        assert!(daemon_rewind.contains("fork_claude_history_session_from_message"));
        assert!(!daemon_rewind.contains("claude_history::"));
        let daemon_delete = daemon
            .split("pub(super) async fn delete_claude_session(")
            .nth(1)
            .and_then(|rest| rest.split("pub(super) async fn list_gemini_sessions(").next())
            .expect("daemon delete_claude_session");
        assert!(daemon_delete.contains("delete_claude_history_session"));
        assert!(!daemon_delete.contains("claude_history::"));
        let catalog_inventory = include_str!(
            "../../../docs/architecture/plugin-platform/inventory/claude-history-catalog.json"
        );
        assert!(catalog_inventory.contains(
            "list_claude_sessions_for_attribution_scopes_with_config"
        ));
        assert!(catalog_inventory.contains("delete_claude_session_with_config"));
        assert!(catalog_inventory.contains("resolve_claude_session_file_with_config"));
        let catalog = include_str!("../session_management.rs");
        assert!(catalog.contains("list_claude_history_sessions_for_attribution_scopes"));
        assert!(!catalog.contains("claude_history::list_claude_sessions_for_attribution_scopes_with_config"));
        assert!(catalog.contains("owned_claude_history"));
        assert!(catalog.contains("delete_session"));
        assert!(!catalog.contains("claude_history::delete_claude_session_with_config"));
        let manager = include_str!("../engine/manager.rs");
        assert!(manager.contains("fn list_claude_history_sessions_for_attribution_scopes("));
        assert!(manager.contains("list_history_sessions_for_attribution_scopes"));
        let projection = include_str!("../session_management_catalog_projection.rs");
        assert!(projection.contains("list_claude_history_source_facts_for_attribution_scopes"));
        assert!(projection.contains("list_workspace_only_claude_history_source_facts_for_attribution_scopes"));
        assert!(!projection.contains("claude_history::list_claude_session_source_facts"));
        assert!(!projection.contains("claude_history::list_workspace_only_claude_session_source_facts"));
        let native = include_str!("../native_continuation/commands.rs");
        assert!(native.contains("resolve_claude_history_session_file"));
        assert!(!native.contains("claude_history::resolve_claude_session_file_with_config"));
        let remaining = include_str!(
            "../../../docs/architecture/plugin-platform/inventory/claude-history-remaining.json"
        );
        assert!(remaining.contains("productOperationsFacaded"));
        assert!(remaining.contains("encode_project_path"));
        assert!(remaining.contains("sessionIndexHelper"));
        let writers = include_str!("../session_index/writers.rs");
        assert!(writers.contains("use crate::engine::claude_history::encode_project_path"));
        assert!(!writers.contains("list_claude_sessions"));
        assert!(!writers.contains("delete_claude_session"));
        let package = include_str!("../../../packages/plugin-engine-claude/.mossx-plugin/plugin.json");
        assert!(package.contains("\"pluginId\": \"com.mossx.engine.claude\""));
        assert!(package.contains("\"id\": \"claude-cli\""));
        assert!(package.contains("\"id\": \"claude-worker\""));
        let boot = include_str!("boot.rs");
        assert!(!boot.contains("plugin-engine-claude"));
        assert!(!boot.contains("packages/plugin-engine-claude"));
        assert!(std::path::Path::new("src/engine/claude.rs").exists());
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
