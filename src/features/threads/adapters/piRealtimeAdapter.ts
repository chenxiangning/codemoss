import type { RealtimeAdapter } from "../contracts/conversationCurtainContracts";
import { mapCommonRealtimeEvent } from "./sharedRealtimeAdapter";

export const piRealtimeAdapter: RealtimeAdapter = {
  engine: "pi",
  mapEvent(input: unknown) {
    return mapCommonRealtimeEvent("pi", input, {
      allowTextDeltaAlias: true,
    });
  },
};
