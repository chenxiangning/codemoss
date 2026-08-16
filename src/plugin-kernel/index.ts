export { parseManifestV1 } from "./parseManifestV1";
export { previewInstall, validateRegistration } from "./installPreview";
export type { InstallPreview, RegistrationRequest, RegistrationResult } from "./installPreview";
export * from "./catalog";
export { decodeMxpc, encodeMxpc } from "./ipc/mxpc";
export { decodeMxpd, encodeMxpd } from "./ipc/mxpd";
export { validateHandshakeAck, validateHandshakeHello } from "./ipc/handshake";
export type {
  ManifestError,
  ManifestErrorCode,
  ParseManifestOptions,
  ParseManifestResult,
  ValidatedManifest,
} from "./types";
