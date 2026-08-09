/**
 * Shared editor for Kimi / Grok / OpenCode / Claude official (local) config files.
 * load → edit → validate → save on top of OfficialConfigEditDialog.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  OfficialConfigEditDialog,
  type OfficialConfigEditorFormat,
} from "./OfficialConfigEditDialog";

export type LocalOfficialConfigFormat = OfficialConfigEditorFormat;

export type LocalOfficialConfigEditDialogProps = {
  isOpen: boolean;
  /** Dialog title (e.g. 官方配置) */
  title: string;
  /** Path label shown above the editor */
  pathLabel: string;
  /** Pane title; defaults to dialog title */
  paneTitle?: string;
  format: LocalOfficialConfigFormat;
  onClose: () => void;
  onSaved?: () => void;
  readContent: () => Promise<string>;
  saveContent: (content: string) => Promise<void>;
  /** Fallback draft when read fails (Claude uses "{}") */
  emptyFallback?: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function LocalOfficialConfigEditDialog({
  isOpen,
  title,
  pathLabel,
  paneTitle,
  format,
  onClose,
  onSaved,
  readContent,
  saveContent,
  emptyFallback = "",
}: LocalOfficialConfigEditDialogProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    void readContent()
      .then((content) => {
        if (!cancelled) {
          setDraft(content);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorMessage(err));
          setDraft(emptyFallback);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [emptyFallback, isOpen, readContent]);

  const handleFormatJson = () => {
    if (format !== "json") {
      return;
    }
    try {
      const parsed = JSON.parse(draft || "{}");
      if (!isJsonObject(parsed)) {
        setError(t("settings.vendor.dialog.jsonError"));
        return;
      }
      setDraft(JSON.stringify(parsed, null, 2));
      setError("");
    } catch {
      setError(t("settings.vendor.dialog.jsonError"));
    }
  };

  const handleSave = async () => {
    let contentToSave = draft;
    if (format === "json" && draft.trim() !== "") {
      try {
        const parsed = JSON.parse(draft);
        if (!isJsonObject(parsed)) {
          setError(t("settings.vendor.dialog.jsonError"));
          return;
        }
        contentToSave = JSON.stringify(parsed, null, 2);
      } catch {
        setError(t("settings.vendor.dialog.jsonError"));
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      await saveContent(contentToSave);
      setDraft(contentToSave);
      onSaved?.();
      onClose();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <OfficialConfigEditDialog
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      onSave={handleSave}
      loading={loading}
      saving={saving}
      error={error || null}
      panes={[
        {
          id: "primary",
          title: paneTitle ?? title,
          pathLabel,
          value: draft,
          onChange: (value) => {
            setDraft(value);
            setError("");
          },
          ariaLabel: paneTitle ?? title,
          format,
          showFormatJson: format === "json",
          onFormatJson: handleFormatJson,
        },
      ]}
    />
  );
}
