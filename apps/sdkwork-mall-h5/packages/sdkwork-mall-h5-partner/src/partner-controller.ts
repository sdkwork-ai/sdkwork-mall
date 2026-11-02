import { useEffect, useMemo, useSyncExternalStore } from "react";

import {
  createSdkworkPartnerController,
  type SdkworkPartnerController,
  type SdkworkPartnerControllerState,
} from "@sdkwork/mall-partner-service";

import { getSdkworkH5PartnerService } from "./partner-service.ts";

export type {
  SdkworkPartnerController,
  SdkworkPartnerControllerState,
  SdkworkPartnerLoadStatus,
} from "@sdkwork/mall-partner-service";

export function useSdkworkPartnerController(
  controller?: SdkworkPartnerController,
): SdkworkPartnerController {
  return useMemo(
    () => controller ?? createSdkworkPartnerController(getSdkworkH5PartnerService()),
    [controller],
  );
}

export function useSdkworkPartnerControllerState(
  controller: SdkworkPartnerController,
): SdkworkPartnerControllerState {
  const state = useSyncExternalStore(
    (listener) => controller.subscribe(listener),
    () => controller.getState(),
    () => controller.getState(),
  );
  useEffect(() => {
    if (state.status === "idle") {
      void controller.bootstrap();
    }
  }, [controller, state.status]);
  return state;
}
