import { useCallback, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useTranslation } from "react-i18next";
import CopyX from "lucide-react/dist/esm/icons/copy-x";
import PanelRightClose from "lucide-react/dist/esm/icons/panel-right-close";
import PanelTopClose from "lucide-react/dist/esm/icons/panel-top-close";
import X from "lucide-react/dist/esm/icons/x";
import {
  clampRendererContextMenuPosition,
  estimateRendererContextMenuHeight,
  type RendererContextMenuItem,
  type RendererContextMenuState,
} from "@/components/ui/RendererContextMenu";
import {
  resolveBrowserTabCloseTargets,
  type BrowserTabCloseAction,
} from "../utils/browserTabCloseTargets";

export type BrowserTabCloseSessionsHandler = (
  sessionIds: string[],
  options?: { preferActiveId?: string },
) => void;

type UseBrowserTabContextMenuOptions = {
  sessionIds: readonly string[];
  busy: boolean;
  onCloseSessions: BrowserTabCloseSessionsHandler;
};

export function useBrowserTabContextMenu({
  sessionIds,
  busy,
  onCloseSessions,
}: UseBrowserTabContextMenuOptions) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<RendererContextMenuState | null>(null);

  const closeMenu = useCallback(() => {
    setMenu(null);
  }, []);

  const openMenu = useCallback(
    (event: ReactMouseEvent, sessionId: string) => {
      event.preventDefault();
      event.stopPropagation();

      const closeTargets = (action: BrowserTabCloseAction) =>
        resolveBrowserTabCloseTargets(sessionIds, sessionId, action);

      const selectCloseAction = (action: BrowserTabCloseAction) => {
        const targets = closeTargets(action);
        if (targets.length === 0) {
          return;
        }
        const keepInvokedTab = action === "others" || action === "right";
        onCloseSessions(
          targets,
          keepInvokedTab ? { preferActiveId: sessionId } : undefined,
        );
      };

      const items: RendererContextMenuItem[] = [
        {
          type: "item",
          id: "close-current-tab",
          label: t("browserAgent.dock.closeTab"),
          icon: <X size={15} />,
          disabled: busy || closeTargets("current").length === 0,
          onSelect: () => selectCloseAction("current"),
        },
        {
          type: "item",
          id: "close-other-tabs",
          label: t("browserAgent.dock.closeOtherTabs"),
          icon: <CopyX size={15} />,
          disabled: busy || closeTargets("others").length === 0,
          onSelect: () => selectCloseAction("others"),
        },
        {
          type: "item",
          id: "close-tabs-to-the-right",
          label: t("browserAgent.dock.closeTabsToTheRight"),
          icon: <PanelRightClose size={15} />,
          disabled: busy || closeTargets("right").length === 0,
          onSelect: () => selectCloseAction("right"),
        },
        {
          type: "item",
          id: "close-all-tabs",
          label: t("browserAgent.dock.closeAllTabs"),
          icon: <PanelTopClose size={15} />,
          disabled: busy || closeTargets("all").length === 0,
          onSelect: () => selectCloseAction("all"),
        },
      ];

      const position = clampRendererContextMenuPosition(event.clientX, event.clientY, {
        width: 248,
        height: estimateRendererContextMenuHeight(items),
        padding: 10,
      });
      setMenu({
        ...position,
        label: t("browserAgent.dock.tabContextMenu"),
        items,
      });
    },
    [busy, onCloseSessions, sessionIds, t],
  );

  return { menu, openMenu, closeMenu };
}
