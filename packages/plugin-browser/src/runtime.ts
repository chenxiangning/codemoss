export {
  buildBrowserContextAttachment,
  formatBrowserContextPromptOnce,
  parseBrowserContextPrompt,
  stripBrowserContextPrompt,
} from "../../../src/features/browser-agent/utils/attachment";
export { getActiveBrowserContext } from "../../../src/features/browser-agent/state/activeBrowserContext";
export { requestBrowserDockOpenUrl } from "../../../src/features/browser-agent/state/dockEvents";
export { isBrowserAgentDockWindowLabel } from "../../../src/features/browser-agent/browserAgentDockWindow";
export { useBrowserContextAttachment } from "../../../src/features/browser-agent/hooks/useBrowserContextAttachment";
