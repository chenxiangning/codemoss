export { noteCardsFacade } from "../../../src/features/note-cards/services/noteCardsFacade";
export {
  NOTE_CARD_CONTEXT_SUMMARY_PREFIX,
  buildNoteBlock,
  injectSelectedNoteCardsContext,
} from "../../../src/features/note-cards/utils/noteCardContextInjection";
export type { NoteCardInjectionResult } from "../../../src/features/note-cards/utils/noteCardContextInjection";
export { buildCodeSelectionNoteDraft } from "../../../src/features/note-cards/utils/noteCapture";
export type { NoteCaptureDraft, WorkspaceNoteCaptureRequest } from "../../../src/features/note-cards/types";
