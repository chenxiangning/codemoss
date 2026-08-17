//! Project Map facade. Default isolated sqlite; explicit 0 stays Core files.

use std::collections::HashMap;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde_json::Value;
use tauri::State;

use super::disk_storage::{remove_path, unique_temp_root};
use super::project_map_storage::ProjectMapNamespace;
use crate::project_map::{ProjectMapReadResponse, ProjectMapWriteFile};
use crate::project_map_relations::{
    ProjectMapRelationshipReadResponse, ProjectMapRelationshipScanOptions,
    ProjectMapRelationshipScanResponse, ProjectMapRelationshipWriteFile,
};
use crate::project_memory::embed::{ProjectMemoryEmbedHealth, ProjectMemoryEmbedResult};
use crate::project_memory::embed_index::EmbedIndexRecord;
use crate::project_memory::{
    AutoCaptureInput, CreateProjectMemoryInput, ProjectMemoryDiagnosticsResult, ProjectMemoryItem,
    ProjectMemoryListResult, ProjectMemoryReconcileResult, ProjectMemorySettings,
    UpdateProjectMemoryInput,
};
use crate::state::AppState;

pub const PROJECT_MAP_PLUGIN_ID: &str = "com.mossx.project-map";
pub const PROJECT_MAP_COMPAT_FACADE_ENV: &str = "MOSSX_PROJECT_MAP_COMPAT_FACADE";

pub const PROJECT_MAP_COMMAND_IDS: &[&str] = &[
    "project_map_read",
    "project_map_write_snapshot",
    "project_map_relationship_scan",
    "project_map_relationship_read",
    "project_map_relationship_write_snapshot",
    "project_map_relationship_clear",
    "project_memory_get_settings",
    "project_memory_update_settings",
    "project_memory_list",
    "project_memory_get",
    "project_memory_create",
    "project_memory_update",
    "project_memory_delete",
    "project_memory_diagnostics",
    "project_memory_reconcile",
    "project_memory_capture_auto",
    "project_memory_embed_health",
    "project_memory_embed_text",
    "project_memory_embed_download",
    "project_memory_embed_remove",
    "project_memory_embed_index_list",
    "project_memory_embed_index_upsert",
    "project_memory_embed_index_delete",
    "project_memory_embed_index_clear",
];

/// flag 关 = Core 文件；flag 开 = 隔离 sqlite。同一时刻只有一个 owner。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectMapCompatOwner {
    CoreProjectMap,
    IsolatedProjectMap,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectMapSnapshot {
    pub workspace_id: String,
    pub node_count: usize,
}

pub trait ProjectMapBackend: Send + Sync {
    fn read(&self, workspace_id: &str) -> Option<ProjectMapSnapshot>;
}

#[derive(Default)]
pub struct MemoryProjectMapBackend {
    snapshots: Mutex<Vec<ProjectMapSnapshot>>,
}

impl MemoryProjectMapBackend {
    pub fn with_snapshots(snapshots: Vec<ProjectMapSnapshot>) -> Self {
        Self {
            snapshots: Mutex::new(snapshots),
        }
    }
}

impl ProjectMapBackend for MemoryProjectMapBackend {
    fn read(&self, workspace_id: &str) -> Option<ProjectMapSnapshot> {
        self.snapshots
            .lock()
            .expect("project map lock")
            .iter()
            .find(|snapshot| snapshot.workspace_id == workspace_id)
            .cloned()
    }
}

pub struct ProjectMapCompatAdapter {
    owner: ProjectMapCompatOwner,
    plugin_id: String,
    backend: Arc<dyn ProjectMapBackend>,
    namespace: Option<ProjectMapNamespace>,
}

pub fn project_map_compat_facade_enabled() -> bool {
    project_map_compat_facade_enabled_from(
        std::env::var_os(PROJECT_MAP_COMPAT_FACADE_ENV).as_deref(),
    )
}

pub fn project_map_compat_facade_enabled_from(value: Option<&OsStr>) -> bool {
    match value.and_then(OsStr::to_str).map(str::trim) {
        None | Some("") => true,
        Some("0" | "false" | "FALSE" | "no" | "off") => false,
        Some("1" | "true" | "TRUE" | "yes" | "on") => true,
        _ => true,
    }
}

impl ProjectMapCompatAdapter {
    pub fn wrapping(backend: Arc<dyn ProjectMapBackend>) -> Self {
        Self {
            owner: ProjectMapCompatOwner::CoreProjectMap,
            plugin_id: PROJECT_MAP_PLUGIN_ID.to_string(),
            backend,
            namespace: None,
        }
    }

    /// 5D 调用面：单 owner Core 门面，delegate 到 `*_core`。
    pub fn core() -> Self {
        Self::wrapping(Arc::new(MemoryProjectMapBackend::default()))
    }

    pub fn isolated(root: impl Into<PathBuf>) -> Result<Self, String> {
        let namespace = ProjectMapNamespace::open(root).map_err(|error| error.message)?;
        Ok(Self {
            owner: ProjectMapCompatOwner::IsolatedProjectMap,
            plugin_id: PROJECT_MAP_PLUGIN_ID.to_string(),
            backend: Arc::new(MemoryProjectMapBackend::default()),
            namespace: Some(namespace),
        })
    }

    pub fn isolated_product() -> Result<Self, String> {
        let adapter = Self::isolated(crate::app_paths::app_home_dir()?)?;
        if let Some(namespace) = adapter.namespace.as_ref() {
            let app_home = crate::app_paths::app_home_dir()?;
            let _ = namespace.import_legacy_once(
                &app_home.join("project-map"),
                &app_home.join("project-map-relations"),
                &crate::app_paths::project_memory_dir()?,
            );
        }
        Ok(adapter)
    }

    pub fn data_file(&self) -> Option<PathBuf> {
        self.namespace.as_ref().map(ProjectMapNamespace::data_file)
    }

    fn namespace(&self) -> Result<&ProjectMapNamespace, String> {
        self.namespace
            .as_ref()
            .ok_or_else(|| "isolated project map namespace missing".to_string())
    }

    fn is_isolated(&self) -> bool {
        self.owner == ProjectMapCompatOwner::IsolatedProjectMap
    }

    pub fn owner(&self) -> ProjectMapCompatOwner {
        self.owner
    }

    pub fn plugin_id(&self) -> &str {
        &self.plugin_id
    }

    pub fn command_ids(&self) -> &'static [&'static str] {
        PROJECT_MAP_COMMAND_IDS
    }

    pub fn read(&self, workspace_id: &str) -> Option<ProjectMapSnapshot> {
        self.backend.read(workspace_id)
    }

    pub async fn read_map(
        &self,
        workspace_id: String,
        storage_mode: Option<String>,
        state: State<'_, AppState>,
    ) -> Result<ProjectMapReadResponse, String> {
        if self.is_isolated() {
            return self.read_map_isolated(&workspace_id);
        }
        crate::project_map::project_map_read_core(workspace_id, storage_mode, state).await
    }

    pub async fn write_snapshot(
        &self,
        workspace_id: String,
        files: Vec<ProjectMapWriteFile>,
        create_backup: Option<bool>,
        storage_mode: Option<String>,
        state: State<'_, AppState>,
    ) -> Result<(), String> {
        if self.is_isolated() {
            return self.write_map_isolated(&workspace_id, files);
        }
        crate::project_map::project_map_write_snapshot_core(
            workspace_id,
            files,
            create_backup,
            storage_mode,
            state,
        )
        .await
    }

    pub async fn relationship_scan(
        &self,
        workspace_id: String,
        options: Option<ProjectMapRelationshipScanOptions>,
        storage_mode: Option<String>,
        state: State<'_, AppState>,
    ) -> Result<ProjectMapRelationshipScanResponse, String> {
        if self.is_isolated() {
            return self.relationship_scan_isolated(workspace_id, options, state).await;
        }
        crate::project_map_relations::project_map_relationship_scan_core(
            workspace_id,
            options,
            storage_mode,
            state,
        )
        .await
    }

    pub async fn relationship_read(
        &self,
        workspace_id: String,
        storage_mode: Option<String>,
        state: State<'_, AppState>,
    ) -> Result<ProjectMapRelationshipReadResponse, String> {
        if self.is_isolated() {
            return self.read_relations_isolated(&workspace_id);
        }
        crate::project_map_relations::project_map_relationship_read_core(
            workspace_id,
            storage_mode,
            state,
        )
        .await
    }

    pub async fn relationship_write_snapshot(
        &self,
        workspace_id: String,
        files: Vec<ProjectMapRelationshipWriteFile>,
        create_backup: Option<bool>,
        storage_mode: Option<String>,
        state: State<'_, AppState>,
    ) -> Result<(), String> {
        if self.is_isolated() {
            return self.write_relations_isolated(&workspace_id, files);
        }
        crate::project_map_relations::project_map_relationship_write_snapshot_core(
            workspace_id,
            files,
            create_backup,
            storage_mode,
            state,
        )
        .await
    }

    pub async fn relationship_clear(
        &self,
        workspace_id: String,
        storage_mode: Option<String>,
        state: State<'_, AppState>,
    ) -> Result<(), String> {
        if self.is_isolated() {
            self.namespace()?.clear_relation_files(&workspace_id)?;
            return Ok(());
        }
        crate::project_map_relations::project_map_relationship_clear_core(
            workspace_id,
            storage_mode,
            state,
        )
        .await
    }

    pub async fn get_settings(&self) -> Result<ProjectMemorySettings, String> {
        if self.is_isolated() {
            return self.namespace()?.get_settings();
        }
        crate::project_memory::commands::project_memory_get_settings_core().await
    }

    pub async fn update_settings(
        &self,
        settings: ProjectMemorySettings,
    ) -> Result<ProjectMemorySettings, String> {
        if self.is_isolated() {
            self.namespace()?.put_settings(&settings)?;
            return Ok(settings);
        }
        crate::project_memory::commands::project_memory_update_settings_core(settings).await
    }

    pub async fn list_memories(
        &self,
        workspace_id: String,
        query: Option<String>,
        kind: Option<String>,
        importance: Option<String>,
        tag: Option<String>,
        page: Option<usize>,
        page_size: Option<usize>,
    ) -> Result<ProjectMemoryListResult, String> {
        if self.is_isolated() {
            return self.list_memories_isolated(
                &workspace_id,
                query.as_deref(),
                kind.as_deref(),
                importance.as_deref(),
                tag.as_deref(),
                page,
                page_size,
            );
        }
        crate::project_memory::commands::project_memory_list_core(
            workspace_id,
            query,
            kind,
            importance,
            tag,
            page,
            page_size,
        )
        .await
    }

    pub async fn get_memory(
        &self,
        memory_id: String,
        workspace_id: String,
    ) -> Result<Option<ProjectMemoryItem>, String> {
        if self.is_isolated() {
            let item = self.namespace()?.get_memory(&memory_id, &workspace_id)?;
            return Ok(item.filter(|memory| memory.deleted_at.is_none()));
        }
        crate::project_memory::commands::project_memory_get_core(memory_id, workspace_id).await
    }

    pub async fn create_memory(
        &self,
        input: CreateProjectMemoryInput,
    ) -> Result<ProjectMemoryItem, String> {
        if self.is_isolated() {
            return self.create_memory_isolated(input);
        }
        crate::project_memory::commands::project_memory_create_core(input).await
    }

    pub async fn update_memory(
        &self,
        memory_id: String,
        workspace_id: String,
        patch: UpdateProjectMemoryInput,
    ) -> Result<ProjectMemoryItem, String> {
        if self.is_isolated() {
            return self.update_memory_isolated(&memory_id, &workspace_id, patch);
        }
        crate::project_memory::commands::project_memory_update_core(memory_id, workspace_id, patch)
            .await
    }

    pub async fn delete_memory(
        &self,
        memory_id: String,
        workspace_id: String,
    ) -> Result<(), String> {
        if self.is_isolated() {
            return self.namespace()?.delete_memory(&memory_id, &workspace_id);
        }
        crate::project_memory::commands::project_memory_delete_core(memory_id, workspace_id).await
    }

    pub async fn diagnostics(
        &self,
        workspace_id: String,
    ) -> Result<ProjectMemoryDiagnosticsResult, String> {
        if self.is_isolated() {
            return self.diagnostics_isolated(&workspace_id);
        }
        crate::project_memory::commands::project_memory_diagnostics_core(workspace_id).await
    }

    pub async fn reconcile(
        &self,
        workspace_id: String,
        dry_run: bool,
    ) -> Result<ProjectMemoryReconcileResult, String> {
        if self.is_isolated() {
            return Ok(ProjectMemoryReconcileResult {
                workspace_id,
                dry_run,
                fixable_count: 0,
                fixed_count: 0,
                skipped_count: 0,
                duplicate_groups: 0,
                changed_memory_ids: Vec::new(),
            });
        }
        crate::project_memory::commands::project_memory_reconcile_core(workspace_id, dry_run).await
    }

    pub async fn capture_auto(
        &self,
        input: AutoCaptureInput,
    ) -> Result<Option<ProjectMemoryItem>, String> {
        if self.is_isolated() {
            return self.capture_auto_isolated(input);
        }
        crate::project_memory::commands::project_memory_capture_auto_core(input).await
    }

    pub async fn embed_health(
        &self,
        app: tauri::AppHandle,
    ) -> Result<ProjectMemoryEmbedHealth, String> {
        crate::project_memory::embed::project_memory_embed_health_core(app).await
    }

    pub async fn embed_text(
        &self,
        app: tauri::AppHandle,
        text: String,
    ) -> Result<ProjectMemoryEmbedResult, String> {
        crate::project_memory::embed::project_memory_embed_text_core(app, text).await
    }

    pub async fn embed_download(
        &self,
        app: tauri::AppHandle,
    ) -> Result<ProjectMemoryEmbedHealth, String> {
        crate::project_memory::embed::project_memory_embed_download_core(app).await
    }

    pub async fn embed_remove(
        &self,
        app: tauri::AppHandle,
    ) -> Result<ProjectMemoryEmbedHealth, String> {
        crate::project_memory::embed::project_memory_embed_remove_core(app).await
    }

    pub async fn embed_index_list(
        &self,
        workspace_id: String,
    ) -> Result<Vec<EmbedIndexRecord>, String> {
        if self.is_isolated() {
            return self.namespace()?.list_embeds(&workspace_id);
        }
        crate::project_memory::embed_index::project_memory_embed_index_list_core(workspace_id).await
    }

    pub async fn embed_index_upsert(
        &self,
        workspace_id: String,
        records: Vec<EmbedIndexRecord>,
    ) -> Result<(), String> {
        if self.is_isolated() {
            let namespace = self.namespace()?;
            for record in records {
                namespace.upsert_embed(&record)?;
            }
            let _ = workspace_id;
            return Ok(());
        }
        crate::project_memory::embed_index::project_memory_embed_index_upsert_core(
            workspace_id,
            records,
        )
        .await
    }

    pub async fn embed_index_delete(
        &self,
        workspace_id: String,
        memory_ids: Vec<String>,
    ) -> Result<(), String> {
        if self.is_isolated() {
            self.namespace()?.delete_embeds(&workspace_id, &memory_ids)?;
            return Ok(());
        }
        crate::project_memory::embed_index::project_memory_embed_index_delete_core(
            workspace_id,
            memory_ids,
        )
        .await
    }

    pub async fn embed_index_clear(&self, workspace_id: String) -> Result<(), String> {
        if self.is_isolated() {
            self.namespace()?.clear_embeds(&workspace_id)?;
            return Ok(());
        }
        crate::project_memory::embed_index::project_memory_embed_index_clear_core(workspace_id)
            .await
    }

    fn read_map_isolated(&self, workspace_id: &str) -> Result<ProjectMapReadResponse, String> {
        let namespace = self.namespace()?;
        let files = file_map(namespace.list_map_files(workspace_id)?);
        Ok(ProjectMapReadResponse {
            storage_key: workspace_id.to_string(),
            storage_dir: namespace.data_file().to_string_lossy().to_string(),
            exists: files.contains_key("manifest.json"),
            manifest: parse_json(&files, "manifest.json"),
            profile: parse_json(&files, "profile.json"),
            lenses: parse_json(&files, "lenses/manifest.json"),
            lens_nodes: parse_lens_nodes(&files),
            view_state: parse_json(&files, "view-state.json"),
            settings: parse_json(&files, "settings.json"),
            cursor: parse_json(&files, "memory-ingestion/cursor.json"),
            processed: parse_json(&files, "memory-ingestion/processed.json"),
            candidates: parse_json_dir(&files, "candidates/"),
            evidence: parse_json_dir(&files, "evidence/"),
            runs: parse_json_dir(&files, "runs/"),
            diagrams: parse_json(&files, "diagrams/manifest.json"),
            relations: parse_json(&files, "relations/latest.json"),
        })
    }

    fn write_map_isolated(
        &self,
        workspace_id: &str,
        files: Vec<ProjectMapWriteFile>,
    ) -> Result<(), String> {
        let namespace = self.namespace()?;
        for file in files {
            crate::project_map::validate_relative_project_map_path(&file.relative_path)?;
            namespace.put_map_file(
                workspace_id,
                workspace_id,
                &file.relative_path,
                &file.content,
            )?;
        }
        Ok(())
    }

    async fn relationship_scan_isolated(
        &self,
        workspace_id: String,
        options: Option<ProjectMapRelationshipScanOptions>,
        state: State<'_, AppState>,
    ) -> Result<ProjectMapRelationshipScanResponse, String> {
        let entry = crate::project_map_relations::workspace_entry(&state, &workspace_id).await?;
        let options = options.unwrap_or(ProjectMapRelationshipScanOptions {
            max_files: None,
            include_ignored_hints: None,
            paths: None,
            changed_files: None,
        });
        let temp = unique_temp_root("project-map-isolated-scan");
        let storage_key = workspace_id.clone();
        let scan_root = temp.clone();
        let result = tokio::task::spawn_blocking(move || {
            crate::project_map_relations::scan_workspace(&entry, &storage_key, &scan_root, options)
        })
        .await
        .map_err(|error| format!("Project map isolated scan task failed: {error}"))?;
        let imported = result;
        match imported {
            Ok(mut response) => {
                self.import_relation_dir(&workspace_id, &temp)?;
                response.storage_dir = self
                    .namespace()?
                    .data_file()
                    .to_string_lossy()
                    .to_string();
                remove_path(Path::new(&temp));
                Ok(response)
            }
            Err(error) => {
                remove_path(Path::new(&temp));
                Err(error)
            }
        }
    }

    fn import_relation_dir(&self, workspace_id: &str, root: &Path) -> Result<(), String> {
        let namespace = self.namespace()?;
        for (relative_path, content) in collect_files(root, root)? {
            if relative_path.starts_with("backups/") {
                continue;
            }
            namespace.put_relation_file(workspace_id, workspace_id, &relative_path, &content)?;
        }
        Ok(())
    }

    fn read_relations_isolated(
        &self,
        workspace_id: &str,
    ) -> Result<ProjectMapRelationshipReadResponse, String> {
        let namespace = self.namespace()?;
        let files = file_map(namespace.list_relation_files(workspace_id)?);
        Ok(ProjectMapRelationshipReadResponse {
            storage_key: workspace_id.to_string(),
            storage_dir: namespace.data_file().to_string_lossy().to_string(),
            exists: files.contains_key("manifest.json"),
            manifest: parse_json(&files, "manifest.json"),
            profile: parse_json(&files, "profile.json"),
            run: parse_json(&files, "runs/latest.json"),
            scan: parse_json(&files, "scans/latest.json"),
            files_manifest: parse_json(&files, "files/manifest.json"),
            files: parse_json(&files, "files/chunks-000.json"),
            relations: parse_json(&files, "relations/latest.json"),
            relations_by_file: parse_json(&files, "relations/by-file.json"),
            relations_by_type: parse_json(&files, "relations/by-type.json"),
            symbols: parse_json(&files, "symbols/chunks-000.json"),
            modules: parse_json(&files, "modules/latest.json"),
            impact: parse_json(&files, "impact/latest.json"),
            context_pack: parse_json(&files, "context-packs/latest.json"),
            api_contracts: parse_json(&files, "api-contracts/latest.json"),
            stale: None,
            repair: parse_json(&files, "repair/latest.json"),
            read_errors: Vec::new(),
        })
    }

    fn write_relations_isolated(
        &self,
        workspace_id: &str,
        files: Vec<ProjectMapRelationshipWriteFile>,
    ) -> Result<(), String> {
        let namespace = self.namespace()?;
        for file in files {
            crate::project_map_relations::validate_relative_relationship_path(&file.relative_path)?;
            namespace.put_relation_file(
                workspace_id,
                workspace_id,
                &file.relative_path,
                &file.content,
            )?;
        }
        Ok(())
    }

    fn list_memories_isolated(
        &self,
        workspace_id: &str,
        query: Option<&str>,
        kind: Option<&str>,
        importance: Option<&str>,
        tag: Option<&str>,
        page: Option<usize>,
        page_size: Option<usize>,
    ) -> Result<ProjectMemoryListResult, String> {
        let mut items = self
            .namespace()?
            .list_memories(workspace_id)?
            .into_iter()
            .filter(|item| item.deleted_at.is_none())
            .filter(|item| kind.is_none_or(|value| item.kind == value))
            .filter(|item| importance.is_none_or(|value| item.importance == value))
            .filter(|item| tag.is_none_or(|value| item.tags.iter().any(|entry| entry == value)))
            .filter(|item| {
                query.is_none_or(|needle| {
                    let needle = needle.to_ascii_lowercase();
                    item.title.to_ascii_lowercase().contains(&needle)
                        || item.summary.to_ascii_lowercase().contains(&needle)
                        || item.clean_text.to_ascii_lowercase().contains(&needle)
                })
            })
            .collect::<Vec<_>>();
        items.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
        let total = items.len();
        let page_index = page.unwrap_or(0);
        let page_limit = page_size.unwrap_or(50).clamp(1, 200);
        let start = page_index.saturating_mul(page_limit);
        let paged = if start >= items.len() {
            Vec::new()
        } else {
            let end = (start + page_limit).min(items.len());
            items[start..end].to_vec()
        };
        Ok(ProjectMemoryListResult {
            items: paged,
            total,
        })
    }

    fn create_memory_isolated(
        &self,
        input: CreateProjectMemoryInput,
    ) -> Result<ProjectMemoryItem, String> {
        let now = now_ms();
        let title = input
            .title
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("untitled")
            .to_string();
        let item = ProjectMemoryItem {
            id: uuid::Uuid::new_v4().to_string(),
            workspace_id: input.workspace_id,
            schema_version: input.schema_version.or(Some(1)),
            record_kind: input.record_kind,
            kind: input.kind.unwrap_or_else(|| "note".to_string()),
            title,
            summary: input.summary.unwrap_or_default(),
            detail: input.detail,
            raw_text: input.user_input.clone(),
            clean_text: input
                .user_input
                .clone()
                .or(input.assistant_response.clone())
                .unwrap_or_default(),
            tags: input.tags.unwrap_or_default(),
            importance: input.importance.unwrap_or_else(|| "medium".to_string()),
            thread_id: input.thread_id,
            turn_id: input.turn_id,
            message_id: input.message_id,
            assistant_message_id: input.assistant_message_id,
            user_input: input.user_input,
            assistant_response: input.assistant_response,
            assistant_thinking_summary: input.assistant_thinking_summary,
            review_state: input.review_state,
            source: input.source.unwrap_or_else(|| "isolated".to_string()),
            fingerprint: format!("isolated-{now}"),
            created_at: now,
            updated_at: now,
            deleted_at: None,
            workspace_name: input.workspace_name,
            workspace_path: input.workspace_path,
            engine: input.engine,
        };
        self.namespace()?.upsert_memory(&item)?;
        Ok(item)
    }

    fn update_memory_isolated(
        &self,
        memory_id: &str,
        workspace_id: &str,
        patch: UpdateProjectMemoryInput,
    ) -> Result<ProjectMemoryItem, String> {
        let mut item = self
            .namespace()?
            .get_memory(memory_id, workspace_id)?
            .ok_or_else(|| "project memory not found".to_string())?;
        if let Some(value) = patch.schema_version {
            item.schema_version = Some(value);
        }
        if let Some(value) = patch.record_kind {
            item.record_kind = Some(value);
        }
        if let Some(value) = patch.kind {
            item.kind = value;
        }
        if let Some(value) = patch.title {
            item.title = value;
        }
        if let Some(value) = patch.summary {
            item.summary = value;
        }
        if let Some(value) = patch.detail {
            item.detail = Some(value);
        }
        if let Some(value) = patch.tags {
            item.tags = value;
        }
        if let Some(value) = patch.importance {
            item.importance = value;
        }
        if let Some(value) = patch.thread_id {
            item.thread_id = Some(value);
        }
        if let Some(value) = patch.turn_id {
            item.turn_id = Some(value);
        }
        if let Some(value) = patch.message_id {
            item.message_id = Some(value);
        }
        if let Some(value) = patch.assistant_message_id {
            item.assistant_message_id = Some(value);
        }
        if let Some(value) = patch.user_input {
            item.user_input = Some(value);
        }
        if let Some(value) = patch.assistant_response {
            item.assistant_response = Some(value);
        }
        if let Some(value) = patch.assistant_thinking_summary {
            item.assistant_thinking_summary = Some(value);
        }
        if let Some(value) = patch.review_state {
            item.review_state = Some(value);
        }
        if let Some(value) = patch.source {
            item.source = value;
        }
        if let Some(value) = patch.workspace_name {
            item.workspace_name = Some(value);
        }
        if let Some(value) = patch.workspace_path {
            item.workspace_path = Some(value);
        }
        if let Some(value) = patch.engine {
            item.engine = Some(value);
        }
        item.updated_at = now_ms();
        self.namespace()?.upsert_memory(&item)?;
        Ok(item)
    }

    fn diagnostics_isolated(
        &self,
        workspace_id: &str,
    ) -> Result<ProjectMemoryDiagnosticsResult, String> {
        let total = self
            .namespace()?
            .list_memories(workspace_id)?
            .into_iter()
            .filter(|item| item.deleted_at.is_none())
            .count();
        Ok(ProjectMemoryDiagnosticsResult {
            workspace_id: workspace_id.to_string(),
            total,
            health_counts: crate::project_memory::ProjectMemoryHealthCounts::default(),
            duplicate_turn_groups: Vec::new(),
            bad_files: Vec::new(),
        })
    }

    fn capture_auto_isolated(
        &self,
        input: AutoCaptureInput,
    ) -> Result<Option<ProjectMemoryItem>, String> {
        let settings = self.namespace()?.get_settings()?;
        if !settings.auto_enabled {
            return Ok(None);
        }
        let text = input.text.trim();
        if text.is_empty() {
            return Ok(None);
        }
        self.create_memory_isolated(CreateProjectMemoryInput {
            workspace_id: input.workspace_id,
            schema_version: Some(1),
            record_kind: Some("auto".to_string()),
            kind: Some("note".to_string()),
            title: Some(text.chars().take(48).collect()),
            summary: Some(text.to_string()),
            detail: Some(text.to_string()),
            tags: None,
            importance: Some("medium".to_string()),
            thread_id: input.thread_id,
            turn_id: input.turn_id,
            message_id: input.message_id,
            assistant_message_id: None,
            user_input: Some(text.to_string()),
            assistant_response: None,
            assistant_thinking_summary: None,
            review_state: None,
            source: input.source.or_else(|| Some("auto".to_string())),
            workspace_name: input.workspace_name,
            workspace_path: input.workspace_path,
            engine: input.engine,
        })
        .map(Some)
    }
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

fn file_map(files: Vec<(String, String)>) -> HashMap<String, String> {
    files.into_iter().collect()
}

fn parse_json(files: &HashMap<String, String>, path: &str) -> Option<Value> {
    files.get(path).and_then(|content| serde_json::from_str(content).ok())
}

fn parse_json_dir(files: &HashMap<String, String>, prefix: &str) -> HashMap<String, Value> {
    let mut values = HashMap::new();
    for (path, content) in files {
        let Some(name) = path.strip_prefix(prefix) else {
            continue;
        };
        if name.contains('/') {
            continue;
        }
        let Some(stem) = name.strip_suffix(".json") else {
            continue;
        };
        if let Ok(value) = serde_json::from_str(content) {
            values.insert(stem.to_string(), value);
        }
    }
    values
}

fn parse_lens_nodes(files: &HashMap<String, String>) -> HashMap<String, Value> {
    let mut values = HashMap::new();
    for (path, content) in files {
        let Some(rest) = path.strip_prefix("lenses/") else {
            continue;
        };
        let Some(lens_id) = rest.strip_suffix("/nodes.json") else {
            continue;
        };
        if lens_id.contains('/') {
            continue;
        }
        if let Ok(value) = serde_json::from_str(content) {
            values.insert(lens_id.to_string(), value);
        }
    }
    values
}

fn collect_files(root: &Path, current: &Path) -> Result<Vec<(String, String)>, String> {
    let mut files = Vec::new();
    let entries = match std::fs::read_dir(current) {
        Ok(entries) => entries,
        Err(_) => return Ok(files),
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            files.extend(collect_files(root, &path)?);
            continue;
        }
        if !path.is_file() {
            continue;
        }
        let relative = path
            .strip_prefix(root)
            .map_err(|error| error.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        let content = std::fs::read_to_string(&path).map_err(|error| error.to_string())?;
        files.push((relative, content));
    }
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn facade_identity_matches_project_map_fixture() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../../packages/plugin-contract/fixtures/valid/project-map-pilot.json"
        ))
        .expect("project-map fixture");
        let fixture_id = fixture
            .get("pluginId")
            .and_then(serde_json::Value::as_str)
            .expect("pluginId");
        let adapter = ProjectMapCompatAdapter::wrapping(Arc::new(MemoryProjectMapBackend::default()));
        assert_eq!(adapter.plugin_id(), fixture_id);
        assert_eq!(adapter.plugin_id(), PROJECT_MAP_PLUGIN_ID);
        assert_eq!(adapter.owner(), ProjectMapCompatOwner::CoreProjectMap);
        assert_eq!(adapter.command_ids(), PROJECT_MAP_COMMAND_IDS);
        assert_eq!(adapter.command_ids().len(), 24);
    }

    #[test]
    fn flag_defaults_to_on() {
        assert!(project_map_compat_facade_enabled_from(None));
        assert!(project_map_compat_facade_enabled_from(Some(OsStr::new(""))));
        assert!(!project_map_compat_facade_enabled_from(Some(OsStr::new("0"))));
        assert!(!project_map_compat_facade_enabled_from(Some(OsStr::new("false"))));
        assert!(project_map_compat_facade_enabled_from(Some(OsStr::new("1"))));
        assert!(project_map_compat_facade_enabled_from(Some(OsStr::new("true"))));
        assert!(project_map_compat_facade_enabled_from(Some(OsStr::new("maybe"))));
    }

    #[test]
    fn memory_backend_shares_the_same_snapshot() {
        let backend = Arc::new(MemoryProjectMapBackend::with_snapshots(vec![
            ProjectMapSnapshot {
                workspace_id: "ws-1".into(),
                node_count: 3,
            },
        ]));
        let adapter = ProjectMapCompatAdapter::wrapping(backend.clone());
        let first = adapter.read("ws-1");
        let second = backend.read("ws-1");
        assert_eq!(first, second);
        assert_eq!(first.expect("snapshot").node_count, 3);
        assert!(adapter.read("ws-missing").is_none());
    }

    #[test]
    fn product_command_registry_stays_on_core() {
        let registry = include_str!("../command_registry.rs");
        for command in PROJECT_MAP_COMMAND_IDS {
            assert!(
                registry.contains(command),
                "{command} must stay registered"
            );
        }
        assert!(registry.contains("crate::project_map::project_map_read"));
        assert!(registry.contains("crate::project_memory::commands::project_memory_list"));
        assert!(std::path::Path::new("src/project_map.rs").exists());
        assert!(std::path::Path::new("src/project_memory").exists());
        assert!(project_map_compat_facade_enabled_from(None));
    }

    #[test]
    fn core_facade_exposes_a_single_core_owner() {
        let adapter = ProjectMapCompatAdapter::core();
        assert_eq!(adapter.owner(), ProjectMapCompatOwner::CoreProjectMap);
        assert_eq!(adapter.plugin_id(), PROJECT_MAP_PLUGIN_ID);
        assert_eq!(adapter.command_ids().len(), 24);
    }

    #[test]
    fn command_entries_dispatch_on_default_on_flag() {
        let sources = [
            include_str!("../project_map.rs"),
            include_str!("../project_map_relations.rs"),
            include_str!("../project_memory/commands.rs"),
            include_str!("../project_memory/embed.rs"),
            include_str!("../project_memory/embed_index.rs"),
        ]
        .join("\n");
        for command in PROJECT_MAP_COMMAND_IDS {
            let core_fn = format!("{command}_core");
            assert!(
                sources.contains(&core_fn),
                "{core_fn} must exist in a product command module"
            );
        }
        assert!(sources.contains("project_map_compat_facade_enabled"));
        assert!(sources.contains("ProjectMapCompatAdapter::isolated_product()?"));
        assert!(project_map_compat_facade_enabled_from(None));
    }

    #[test]
    fn facade_delegates_to_core_not_runtime() {
        let facade = include_str!("project_map_compat.rs");
        let impl_src = facade
            .split("#[cfg(test)]")
            .next()
            .expect("implementation before tests");
        for command in PROJECT_MAP_COMMAND_IDS {
            let core_fn = format!("{command}_core");
            assert!(
                impl_src.contains(&core_fn),
                "facade must call {core_fn}"
            );
        }
        assert!(!impl_src.contains("activate_plugin"));
        assert!(!impl_src.contains("dispatch_command"));
        assert!(std::path::Path::new("src/project_map.rs").exists());
        assert!(std::path::Path::new("src/project_memory").exists());
        assert!(std::path::Path::new("../src/features/project-map").exists());
    }

    #[test]
    fn isolated_adapter_writes_only_the_plugin_namespace() {
        let root = unique_temp_root("project-map-isolated-adapter");
        let adapter = ProjectMapCompatAdapter::isolated(&root).expect("isolated");
        assert_eq!(adapter.owner(), ProjectMapCompatOwner::IsolatedProjectMap);
        let path = adapter.data_file().expect("data file");
        let rendered = path.to_string_lossy();
        assert!(rendered.contains("plugin-runtime/data/com.mossx.project-map/store.sqlite"));
        assert!(!rendered.contains(".ccgui/project-map"));
        assert!(!rendered.contains("project-memory"));

        adapter
            .write_map_isolated(
                "ws-iso",
                vec![ProjectMapWriteFile {
                    relative_path: "manifest.json".into(),
                    content: r#"{"schemaVersion":2,"storageKey":"ws-iso"}"#.into(),
                }],
            )
            .expect("write map");
        let loaded = adapter.read_map_isolated("ws-iso").expect("read map");
        assert!(loaded.exists);
        assert_eq!(loaded.storage_key, "ws-iso");
        assert!(loaded.storage_dir.contains("com.mossx.project-map/store.sqlite"));

        let created = adapter
            .create_memory_isolated(CreateProjectMemoryInput {
                workspace_id: "ws-iso".into(),
                schema_version: Some(1),
                record_kind: None,
                kind: Some("decision".into()),
                title: Some("hello".into()),
                summary: Some("summary".into()),
                detail: None,
                tags: None,
                importance: None,
                thread_id: None,
                turn_id: None,
                message_id: None,
                assistant_message_id: None,
                user_input: None,
                assistant_response: None,
                assistant_thinking_summary: None,
                review_state: None,
                source: None,
                workspace_name: None,
                workspace_path: None,
                engine: None,
            })
            .expect("create memory");
        assert_eq!(created.title, "hello");
        let listed = adapter
            .list_memories_isolated("ws-iso", None, None, None, None, None, None)
            .expect("list");
        assert_eq!(listed.total, 1);

        adapter
            .write_relations_isolated(
                "ws-iso",
                vec![ProjectMapRelationshipWriteFile {
                    relative_path: "manifest.json".into(),
                    content: r#"{"schemaVersion":1}"#.into(),
                }],
            )
            .expect("write relations");
        let relations = adapter.read_relations_isolated("ws-iso").expect("read relations");
        assert!(relations.exists);

        let commands = [
            include_str!("../project_map.rs"),
            include_str!("../project_map_relations.rs"),
            include_str!("../project_memory/commands.rs"),
        ]
        .join("\n");
        assert!(commands.contains("ProjectMapCompatAdapter::isolated_product()?"));
        assert!(project_map_compat_facade_enabled_from(None));
        remove_path(Path::new(&root));
    }
}
