import type { MouseEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Globe from "lucide-react/dist/esm/icons/globe";
import { isHtmlFilePath } from "../../features/files/utils/openHtmlInBrowser";

type MarkdownFileLinkProps = {
  href?: string;
  path: string;
  onOpen: (event: MouseEvent<HTMLAnchorElement>, path: string) => void;
  onOpenMenu: (event: MouseEvent<HTMLAnchorElement>, path: string) => void;
  onOpenHtmlInBrowser?: (path: string) => void;
  children: ReactNode;
};

function stripFileLinkLocationSuffix(path: string) {
  return path.replace(/#L?\d+(?:C\d+)?$/i, "").replace(/:\d+(?::\d+)?$/, "");
}

export function isHtmlMarkdownFilePath(path: string) {
  return isHtmlFilePath(stripFileLinkLocationSuffix(path));
}

export function MarkdownFileLink({
  href,
  path,
  onOpen,
  onOpenMenu,
  onOpenHtmlInBrowser,
  children,
}: MarkdownFileLinkProps) {
  const { t } = useTranslation();
  const showBrowserAction =
    Boolean(onOpenHtmlInBrowser) && isHtmlMarkdownFilePath(path);

  return (
    <span className="markdown-file-link">
      <a
        href={href}
        onClick={(event) => onOpen(event, path)}
        onContextMenu={(event) => onOpenMenu(event, path)}
      >
        {children}
      </a>
      {showBrowserAction ? (
        <button
          type="button"
          className="markdown-file-link-browser"
          aria-label={t("files.openInBrowser")}
          title={t("files.openInBrowser")}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpenHtmlInBrowser?.(path);
          }}
        >
          <Globe size={12} aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
