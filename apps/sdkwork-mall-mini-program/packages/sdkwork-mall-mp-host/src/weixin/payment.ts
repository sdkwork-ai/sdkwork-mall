/**
 * Payment bridge adapter (`wx.requestPayment`).
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 8. The host only
 * collects the platform payment facts; the order state and the charge itself
 * stay backend/app-api responsibilities. A dismissed cashier surfaces as
 * `cancelled` so the caller can tell it apart from a failed charge.
 */
import { createMpHostError, normalizeMpHostError, type MpPaymentBridge, type MpPaymentRequest } from "../index";

export interface WxPaymentApi {
  requestPayment(options: {
    fail?(result: { errMsg?: string }): void;
    nonceStr: string;
    package: string;
    paySign: string;
    signType?: string;
    success?(): void;
    timeStamp: string;
  }): void;
}

export function createWeixinPaymentBridge(api: WxPaymentApi): MpPaymentBridge {
  return {
    requestPayment(request: MpPaymentRequest) {
      return new Promise<void>((resolve, reject) => {
        api.requestPayment({
          nonceStr: request.nonceStr,
          package: request.package,
          paySign: request.paySign,
          timeStamp: request.timeStamp,
          ...(request.signType ? { signType: request.signType } : {}),
          success: () => resolve(),
          fail: (result) => {
            if (/cancel/iu.test(result.errMsg ?? "")) {
              reject(createMpHostError("cancelled", result.errMsg ?? "支付已取消", result));
              return;
            }
            reject(normalizeMpHostError(result));
          },
        });
      });
    },
  };
}
