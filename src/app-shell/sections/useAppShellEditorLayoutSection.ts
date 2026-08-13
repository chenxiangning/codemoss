import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useGitHistoryPanelResize } from "../../features/app/hooks/useGitHistoryPanelResize";
import type { AppMode } from "../../types";

export type ActiveEditorLineRange = {
  startLine: number;
  endLine: number;
} | null;

export type EditorFileReferenceMode = "path" | "none";
export type EditorSplitLayout = "vertical" | "horizontal";

export type AppShellEditorLayoutSectionInput = {
  collapseSidebar: () => void;
  setAppMode: Dispatch<SetStateAction<AppMode>>;
  setRightPanelWidth: (width: number) => void;
};

export function useAppShellEditorLayoutSection({
  collapseSidebar,
  setAppMode,
  setRightPanelWidth,
}: AppShellEditorLayoutSectionInput) {
  const [activeEditorLineRange, setActiveEditorLineRange] =
    useState<ActiveEditorLineRange>(null);
  const [fileReferenceMode, setFileReferenceMode] =
    useState<EditorFileReferenceMode>("none");
  const [editorSplitLayout, setEditorSplitLayout] =
    useState<EditorSplitLayout>("vertical");
  const [isEditorFileMaximized, setIsEditorFileMaximized] = useState(false);
  const [liveEditPreviewEnabled, setLiveEditPreviewEnabled] = useState(false);

  const requestEditorOpenLayout = useCallback(() => {
    collapseSidebar();
    setEditorSplitLayout((current) =>
      current === "horizontal" ? current : "horizontal",
    );
    setIsEditorFileMaximized((current) => (current ? false : current));
  }, [collapseSidebar]);

  const appRootRef = useRef<HTMLDivElement | null>(null);
  const {
    gitHistoryPanelHeight,
    gitHistoryPanelHeightRef,
    onGitHistoryPanelResizeStart,
    setGitHistoryPanelHeight,
  } = useGitHistoryPanelResize({
    appRootRef,
    onClosePanel: () => {
      setAppMode("chat");
    },
  });

  const resetSoloSplitToHalf = useCallback(() => {
    window.requestAnimationFrame(() => {
      const appRoot = appRootRef.current;
      const main = appRoot?.querySelector<HTMLElement>(".main");
      const mainWidth = main?.clientWidth ?? window.innerWidth;
      setRightPanelWidth(Math.floor(mainWidth / 2));
    });
  }, [setRightPanelWidth]);

  return {
    activeEditorLineRange,
    appRootRef,
    editorSplitLayout,
    fileReferenceMode,
    gitHistoryPanelHeight,
    gitHistoryPanelHeightRef,
    isEditorFileMaximized,
    liveEditPreviewEnabled,
    onGitHistoryPanelResizeStart,
    requestEditorOpenLayout,
    resetSoloSplitToHalf,
    setActiveEditorLineRange,
    setEditorSplitLayout,
    setFileReferenceMode,
    setGitHistoryPanelHeight,
    setIsEditorFileMaximized,
    setLiveEditPreviewEnabled,
  };
}
