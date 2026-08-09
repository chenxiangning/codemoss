/**
 * Claude official settings.json editor — thin adapter over LocalOfficialConfigEditDialog.
 */
import { useTranslation } from "react-i18next";
import {
  readClaudeSettingsJson,
  saveClaudeSettingsJson,
} from "../../../services/tauri";
import { LocalOfficialConfigEditDialog } from "./LocalOfficialConfigEditDialog";

interface ClaudeSettingsJsonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ClaudeSettingsJsonDialog({
  isOpen,
  onClose,
  onSaved,
}: ClaudeSettingsJsonDialogProps) {
  const { t } = useTranslation();

  return (
    <LocalOfficialConfigEditDialog
      isOpen={isOpen}
      title={t("settings.vendor.officialConfig")}
      paneTitle={t("settings.vendor.localProviderName")}
      pathLabel="~/.claude/settings.json"
      format="json"
      emptyFallback="{}"
      onClose={onClose}
      onSaved={onSaved}
      readContent={readClaudeSettingsJson}
      saveContent={saveClaudeSettingsJson}
    />
  );
}
