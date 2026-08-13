import type { MouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import GripVertical from "lucide-react/dist/esm/icons/grip-vertical";
import ListChevronsDownUp from "lucide-react/dist/esm/icons/list-chevrons-down-up";
import ListChevronsUpDown from "lucide-react/dist/esm/icons/list-chevrons-up-down";
import SquarePlus from "lucide-react/dist/esm/icons/square-plus";
import type { WorkspaceInfo } from "../../../types";
import { TooltipIconButton } from "../../../components/ui/tooltip-icon-button";
import { isDefaultWorkspacePath } from "../../workspaces/utils/defaultWorkspace";

function isActivationKey(key: string) {
  return key === "Enter" || key === " " || key === "Space" || key === "Spacebar";
}

// 用户在「...」菜单里勾选后，回到项目行外显的快捷动作。
export type WorkspaceRowPinnedAction = {
  id: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  className?: string;
  onSelect: () => void;
};

type WorkspaceCardProps = {
  workspace: WorkspaceInfo;
  workspaceName?: React.ReactNode;
  workspaceAliasOriginalName?: string | null;
  isActive: boolean;
  hasPrimaryActiveThread: boolean;
  hasRunningSession?: boolean;
  isCollapsed: boolean;
  onShowWorkspaceMenu: (event: MouseEvent, workspace: WorkspaceInfo) => void;
  onOpenWorkspaceHome?: (workspaceId: string) => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onToggleWorkspaceCollapse: (workspaceId: string, collapsed: boolean) => void;
  pinnedRowActions?: WorkspaceRowPinnedAction[];
  /** Long-press reorder is armed / in progress for this card. */
  isDragging?: boolean;
  /**
   * Long-press entry on the left collapse button only.
   * After arming, that button switches to a drag affordance.
   */
  collapsePointerHandlers?: {
    onPointerDown: (event: ReactPointerEvent) => void;
  } | null;
  children?: React.ReactNode;
};

export function WorkspaceCard({
  workspace,
  workspaceName,
  workspaceAliasOriginalName = null,
  isActive,
  hasPrimaryActiveThread,
  hasRunningSession = false,
  isCollapsed,
  onShowWorkspaceMenu,
  onOpenWorkspaceHome,
  onSelectWorkspace,
  onToggleWorkspaceCollapse,
  pinnedRowActions,
  isDragging = false,
  collapsePointerHandlers = null,
  children,
}: WorkspaceCardProps) {
  const { t } = useTranslation();
  const isDefaultWorkspace = isDefaultWorkspacePath(workspace.path);
  const collapseLabel = isCollapsed
    ? t("sidebar.expandWorkspace")
    : t("sidebar.collapseWorkspace");
  const isReorderable = Boolean(collapsePointerHandlers);
  const isDragHandleMode = isDragging && isReorderable;
  const collapseControlLabel = isDragHandleMode
    ? t("sidebar.dragToReorder")
    : isReorderable
      ? `${collapseLabel} · ${t("sidebar.longPressToReorder")}`
      : collapseLabel;

  const handleToggleCollapse = () => {
    onToggleWorkspaceCollapse(workspace.id, !isCollapsed);
  };
  const handleSelectWorkspace = () => {
    if (onOpenWorkspaceHome) {
      onOpenWorkspaceHome(workspace.id);
      return;
    }
    onSelectWorkspace(workspace.id);
  };
  const folderIcon = !isCollapsed ? (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M5.5 11.5001L6.625 9.32507C6.7473 9.08218 6.93334 8.8771 7.16321 8.73178C7.39307 8.58646 7.65812 8.50637 7.93 8.50007H16M16 8.50007C16.2291 8.49967 16.4553 8.55177 16.6612 8.65238C16.8671 8.75299 17.0472 8.89944 17.1877 9.08047C17.3282 9.26151 17.4253 9.47232 17.4716 9.69674C17.518 9.92115 17.5123 10.1532 17.455 10.3751L16.3 14.8751C16.2164 15.1987 16.0272 15.4852 15.7622 15.689C15.4972 15.8929 15.1718 16.0023 14.8375 16.0001H4C3.60218 16.0001 3.22064 15.842 2.93934 15.5607C2.65804 15.2794 2.5 14.8979 2.5 14.5001V4.75007C2.5 4.35225 2.65804 3.97072 2.93934 3.68941C3.22064 3.40811 3.60218 3.25007 4 3.25007H6.925C7.17586 3.24761 7.42334 3.30811 7.64477 3.42604C7.86621 3.54396 8.05453 3.71554 8.1925 3.92507L8.8 4.82507C8.93658 5.03247 9.12252 5.20271 9.34113 5.32052C9.55973 5.43834 9.80417 5.50003 10.0525 5.50007H14.5C14.8978 5.50007 15.2794 5.65811 15.5607 5.93941C15.842 6.22072 16 6.60225 16 7.00007V8.50007Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M16 16C16.3978 16 16.7794 15.842 17.0607 15.5607C17.342 15.2794 17.5 14.8978 17.5 14.5V7C17.5 6.60218 17.342 6.22064 17.0607 5.93934C16.7794 5.65804 16.3978 5.5 16 5.5H10.075C9.82414 5.50246 9.57666 5.44196 9.35523 5.32403C9.13379 5.20611 8.94547 5.03453 8.8075 4.825L8.2 3.925C8.06342 3.7176 7.87748 3.54736 7.65887 3.42955C7.44027 3.31174 7.19583 3.25004 6.9475 3.25H4C3.60218 3.25 3.22064 3.40804 2.93934 3.68934C2.65804 3.97064 2.5 4.35218 2.5 4.75V14.5C2.5 14.8978 2.65804 15.2794 2.93934 15.5607C3.22064 15.842 3.60218 16 4 16H16Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.5 8.5H17.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div
      className={`workspace-card${isActive ? " is-active" : ""}${
        isDragging ? " is-dragging" : ""
      }${isReorderable ? " is-reorderable" : ""}`}
    >
      <div
        className={`workspace-row ${
          isActive
            ? hasPrimaryActiveThread
              ? "context-active"
              : "active"
            : ""
        }`}
        role="button"
        tabIndex={0}
        onClick={(event) => {
          if (event.detail > 1 || isDragging) {
            return;
          }
          handleSelectWorkspace();
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          if (isDragging) {
            return;
          }
          handleToggleCollapse();
        }}
        onContextMenu={(event) => onShowWorkspaceMenu(event, workspace)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleSelectWorkspace();
          }
        }}
      >
        <div className="workspace-header-content">
          <button
            type="button"
            className={`workspace-folder-btn workspace-collapse-toggle${
              hasRunningSession ? " is-session-running" : ""
            }${isDragHandleMode ? " is-drag-handle" : ""}${
              isReorderable ? " is-reorder-entry" : ""
            }`}
            aria-label={collapseControlLabel}
            title={collapseControlLabel}
            aria-expanded={isDragHandleMode ? undefined : !isCollapsed}
            aria-grabbed={isDragHandleMode ? true : undefined}
            data-tauri-drag-region="false"
            onPointerDown={collapsePointerHandlers?.onPointerDown}
            onClick={(event) => {
              event.stopPropagation();
              // Long-press armed / dragging: this control is the drag entry, not collapse.
              if (isDragging || event.detail > 1) {
                return;
              }
              handleToggleCollapse();
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
            }}
            onKeyDown={(event) => {
              if (isActivationKey(event.key)) {
                event.stopPropagation();
              }
            }}
            onKeyUp={(event) => {
              if (isActivationKey(event.key)) {
                event.stopPropagation();
              }
            }}
          >
            {isDragHandleMode ? (
              <span className="workspace-collapse-toggle-drag-icon" aria-hidden>
                <GripVertical size={14} strokeWidth={1.9} />
              </span>
            ) : (
              <>
                <span className="workspace-collapse-toggle-folder-icon" aria-hidden>
                  {folderIcon}
                </span>
                <span className="workspace-collapse-toggle-affordance-icon" aria-hidden>
                  {isCollapsed ? (
                    <ListChevronsUpDown size={14} strokeWidth={1.8} />
                  ) : (
                    <ListChevronsDownUp size={14} strokeWidth={1.8} />
                  )}
                </span>
              </>
            )}
          </button>

          <span className="workspace-name-text">{workspaceName ?? workspace.name}</span>
          {workspaceAliasOriginalName ? (
            <span
              className="workspace-alias-badge"
              aria-label={t("sidebar.workspaceAliasBadgeTitle", {
                name: workspaceAliasOriginalName,
              })}
              title={t("sidebar.workspaceAliasBadgeTitle", {
                name: workspaceAliasOriginalName,
              })}
            >
              {t("sidebar.workspaceAliasBadge")}
            </span>
          ) : null}
          {isDefaultWorkspace ? (
            <span className="default-workspace-badge" aria-label="Default Workspace">
              Default
            </span>
          ) : null}

          <div className="workspace-actions">
            {pinnedRowActions?.map((action) => (
              <TooltipIconButton
                key={action.id}
                className={`workspace-action-btn${
                  action.className ? ` ${action.className}` : ""
                }${action.active ? " is-active" : ""}`}
                aria-pressed={action.active}
                data-tauri-drag-region="false"
                onClick={(event) => {
                  event.stopPropagation();
                  action.onSelect();
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                }}
                label={action.label}
              >
                {action.icon}
              </TooltipIconButton>
            ))}
            <TooltipIconButton
              className="workspace-action-btn"
              onClick={(event) => {
                event.stopPropagation();
                onShowWorkspaceMenu(event, workspace);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
              }}
              label={t("sidebar.sessionActionsGroup")}
            >
              <SquarePlus size={15} strokeWidth={1.85} aria-hidden />
            </TooltipIconButton>
          </div>
        </div>
      </div>
      {children ? (
        <div
          className={`workspace-children ${isCollapsed ? "is-collapsed" : "is-expanded"}`}
          aria-hidden={isCollapsed}
          inert={isCollapsed}
        >
          <div className="workspace-children-inner">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
