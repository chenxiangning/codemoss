import { useCallback } from 'react';
import type { Attachment } from '../types.js';
import { generateId } from '../utils/generateId.js';
import { debugError } from '../../../utils/debug.js';
import { pickFiles } from '../../../../../services/tauri';

export interface UseAttachmentHandlersOptions {
  externalAttachments: Attachment[] | undefined;
  onAddAttachment?: (files?: FileList | null) => void;
  onRemoveAttachment?: (id: string) => void;
  onAttachPaths?: (paths: string[]) => boolean;
  setInternalAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
}

/**
 * useAttachmentHandlers - Handle attachment add/remove
 *
 * Supports both controlled (external) and uncontrolled (internal) attachment modes.
 */
export function useAttachmentHandlers({
  externalAttachments,
  onAddAttachment,
  onRemoveAttachment,
  onAttachPaths,
  setInternalAttachments,
}: UseAttachmentHandlersOptions) {
  const handleAddAttachment = useCallback(
    (files?: FileList | null) => {
      const selectedPaths = Array.from(files ?? [])
        .map((file) => ((file as File & { path?: string }).path ?? '').trim())
        .filter(Boolean);
      if (selectedPaths.length > 0 && onAttachPaths?.(selectedPaths)) {
        return;
      }

      if (!files || files.length === 0) {
        void pickFiles()
          .then((pickedPaths) => {
            if (pickedPaths.length > 0 && onAttachPaths?.(pickedPaths)) {
              return;
            }
            onAddAttachment?.();
          })
          .catch(() => {
            onAddAttachment?.();
          });
        return;
      }

      if (externalAttachments !== undefined) {
        onAddAttachment?.(files);
        return;
      }

      Array.from(files).forEach((file) => {
        const fileName = file.name || '';
        const lowerName = fileName.toLowerCase();
        const looksLikeImage =
          file.type.startsWith('image/') ||
          lowerName.endsWith('.png') ||
          lowerName.endsWith('.jpg') ||
          lowerName.endsWith('.jpeg') ||
          lowerName.endsWith('.gif') ||
          lowerName.endsWith('.webp') ||
          lowerName.endsWith('.bmp') ||
          lowerName.endsWith('.tif') ||
          lowerName.endsWith('.tiff') ||
          lowerName.endsWith('.svg');
        if (!looksLikeImage) {
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result !== 'string') return;
          const commaIndex = result.indexOf(',');
          if (commaIndex === -1) return;
          const base64 = result.substring(commaIndex + 1);
          const attachment: Attachment = {
            id: generateId(),
            fileName: file.name,
            mediaType: file.type || 'application/octet-stream',
            data: base64,
          };
          setInternalAttachments((prev) => [...prev, attachment]);
        };
        reader.onerror = () => {
          debugError('[useAttachmentHandlers] Failed to read file:', file.name);
        };
        reader.onabort = () => {
          debugError('[useAttachmentHandlers] File read aborted:', file.name);
        };
        reader.readAsDataURL(file);
      });
    },
    [externalAttachments, onAddAttachment, onAttachPaths, setInternalAttachments]
  );

  const handleRemoveAttachment = useCallback(
    (id: string) => {
      if (externalAttachments !== undefined) {
        onRemoveAttachment?.(id);
        return;
      }
      setInternalAttachments((prev) => prev.filter((a) => a.id !== id));
    },
    [externalAttachments, onRemoveAttachment, setInternalAttachments]
  );

  return { handleAddAttachment, handleRemoveAttachment };
}
