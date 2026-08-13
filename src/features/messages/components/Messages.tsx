import { memo } from "react";
import { loadToolBlockStyles } from "../../../styles/featureStyleLoaders";
import { useFeatureStylesReady } from "../../../styles/useFeatureStylesReady";
import { adaptLegacyMessagesProps } from "../contracts/messagesInput";
import type { MessagesProps } from "../types/messagesTypes";
import { MessagesCore } from "./MessagesCore";

export const Messages = memo(function Messages(props: MessagesProps) {
  // P1-1: tool-block CSS is deferred from bootstrap; kick load when conversation mounts.
  useFeatureStylesReady(loadToolBlockStyles);
  return <MessagesCore {...adaptLegacyMessagesProps(props)} />;
});
