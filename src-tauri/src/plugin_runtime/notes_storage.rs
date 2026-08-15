//! Wave 4D: Notes namespace on injected DiskStorage. Does not read product note_cards.

use std::path::{Path, PathBuf};

use super::disk_storage::{remove_path, unique_temp_root, DiskStorage};
use super::storage::{MigrationPlan, StorageError};

pub const NOTES_PLUGIN_ID: &str = "com.mossx.notes";

pub fn open_notes_namespace(root: impl Into<PathBuf>) -> Result<DiskStorage, StorageError> {
    let mut storage = DiskStorage::open(root)?;
    storage.open_plugin(NOTES_PLUGIN_ID, "1.0.0", "1.0.0", 1)?;
    Ok(storage)
}

fn compatible_plan(from: u32, to: u32, reader: u32) -> MigrationPlan {
    MigrationPlan {
        from,
        to,
        destructive: false,
        export_required: false,
        confirmed: false,
        exported: false,
        reader_schema: reader,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn injected_root_gets_notes_sqlite() {
        let root = unique_temp_root("notes-ns");
        let storage = open_notes_namespace(&root).expect("open notes");
        let path = storage.data_file(NOTES_PLUGIN_ID);
        assert!(path.ends_with("plugin-runtime/data/com.mossx.notes/store.sqlite"));
        assert!(path.exists());
        assert!(!path.to_string_lossy().contains("note_cards"));
        remove_path(Path::new(&root));
    }

    #[test]
    fn notes_restore_returns_checkpoint_schema() {
        let root = unique_temp_root("notes-restore");
        let mut storage = open_notes_namespace(&root).expect("open notes");
        storage.checkpoint(NOTES_PLUGIN_ID, 2).expect("ckpt");
        storage
            .migrate(NOTES_PLUGIN_ID, compatible_plan(1, 2, 2))
            .expect("migrate");
        assert_eq!(storage.read_schema(NOTES_PLUGIN_ID).unwrap(), 2);
        storage.restore(NOTES_PLUGIN_ID).expect("restore");
        assert_eq!(storage.read_schema(NOTES_PLUGIN_ID).unwrap(), 1);
        remove_path(Path::new(&root));
    }
}
