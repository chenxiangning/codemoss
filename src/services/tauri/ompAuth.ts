import { invoke } from "@tauri-apps/api/core";

export type OmpAuthBrokerStatus = {
  state: "configured" | "not-configured";
  configured: boolean;
  reason?: string | null;
};

export type OmpAuthBrokerProvider = {
  id: string;
  name: string;
};

export function ompAuthBrokerStatus(): Promise<OmpAuthBrokerStatus> {
  return invoke<OmpAuthBrokerStatus>("omp_auth_broker_status");
}

export function ompAuthBrokerListProviders(): Promise<OmpAuthBrokerProvider[]> {
  return invoke<OmpAuthBrokerProvider[]>("omp_auth_broker_list_providers");
}

export type OmpLocalAccount = {
  provider: string;
  credentialType: string;
  identity?: string | null;
  disabledCause?: string | null;
  updatedAt?: number | null;
};

/** OMP 本地登录态（~/.omp/agent 凭据元数据，无 token/key）。 */
export function ompAuthLocalAccounts(): Promise<OmpLocalAccount[]> {
  return invoke<OmpLocalAccount[]>("omp_auth_local_accounts");
}
