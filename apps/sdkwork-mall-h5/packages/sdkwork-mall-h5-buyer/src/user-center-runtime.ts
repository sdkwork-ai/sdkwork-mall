import type { SdkworkIamService } from "@sdkwork/iam-service";

/**
 * Host-injected IAM service for the account surfaces.
 *
 * The profile/password bricks call the IAM service facade through their
 * controller; the mall root owns the one IAM runtime, so it injects that
 * service here instead of letting the pages build a client
 * (`APP_H5_ARCHITECTURE_SPEC` §7).
 */
let iamService: SdkworkIamService | null = null;

/** Wires the IAM service consumed by the account bricks. */
export function configureSdkworkMallH5UserCenter(service: SdkworkIamService): void {
  iamService = service;
}

/** Returns the injected IAM service, or throws before the runtime is composed. */
export function getSdkworkMallH5UserCenterService(): SdkworkIamService {
  if (!iamService) {
    throw new Error("sdkwork-mall-h5: the IAM service is not configured for the user center");
  }
  return iamService;
}
