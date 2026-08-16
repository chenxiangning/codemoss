export type {
  CodeAnnotationAnchor,
  CodeAnnotationBridgeProps,
  CodeAnnotationDraftInput,
  CodeAnnotationLineRange,
  CodeAnnotationSelection,
  CodeAnnotationSource,
} from "../../../src/features/code-annotations/types";
export {
  appendCodeAnnotationsToPrompt,
  attachCodeAnnotationAnchor,
  buildCodeAnnotationDedupeKey,
  CODE_ANNOTATION_RELOCATION_WINDOW_LINES,
  createCodeAnnotationAnchor,
  createCodeAnnotationAnchorFromSnapshot,
  createCodeAnnotationSelection,
  formatCodeAnnotationForPrompt,
  formatCodeAnnotationLineRange,
  formatCodeAnnotationReference,
  isSameCodeAnnotationPath,
  normalizeCodeAnnotationTarget,
  resolveCodeAnnotationAnchor,
  resolveCodeAnnotationsForFile,
} from "../../../src/features/code-annotations/utils/codeAnnotations";
export type { CodeAnnotationAnchorResolution } from "../../../src/features/code-annotations/utils/codeAnnotations";
