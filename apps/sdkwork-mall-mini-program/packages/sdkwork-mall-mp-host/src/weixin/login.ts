/**
 * `wx.login` adapter.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 8. The one-time
 * `jsCode` is the only credential the mini program can obtain from the
 * platform; it is exchanged for an IAM session by `@sdkwork/mall-mp-core`
 * (`oauth.miniProgramSessions.create`). The code is never logged or persisted.
 */
import { resolvePlatformScope } from "./scope";
import {
  createMpHostError,
  normalizeMpHostError,
  type MpLoginCodeProvider,
} from "../index";

export interface WxLoginResult {
  code?: string;
  errMsg?: string;
}

export interface WxLoginApi {
  login(options: {
    fail(result: WxLoginResult): void;
    success(result: WxLoginResult): void;
    timeout?: number;
  }): void;
}

const DEFAULT_LOGIN_TIMEOUT_MS = 10_000;

export function createWeixinLoginCodeProvider(
  login: WxLoginApi["login"],
  timeoutMs: number = DEFAULT_LOGIN_TIMEOUT_MS,
): MpLoginCodeProvider {
  return {
    async requestLoginCode(): Promise<string> {
      return await new Promise<string>((resolve, reject) => {
        login({
          timeout: timeoutMs,
          success(result) {
            const code = typeof result.code === "string" ? result.code.trim() : "";
            if (code) {
              resolve(code);
              return;
            }
            // Keeping the platform wording makes a blocked login diagnosable
            // without guessing which review rule rejected it.
            reject(createMpHostError("invalid-state", result.errMsg ?? "wx.login 未返回 code"));
          },
          fail(result) {
            reject(normalizeMpHostError(result));
          },
        });
      });
    },
  };
}

export function readWeixinLoginApi(scope: { wx?: Partial<WxLoginApi> } = resolvePlatformScope() as { wx?: Partial<WxLoginApi> }): WxLoginApi {
  const candidate = scope.wx;
  if (!candidate || typeof candidate.login !== "function") {
    throw createMpHostError("unsupported", "当前运行环境不支持 wx.login");
  }
  return candidate as WxLoginApi;
}

export function createWeixinLoginCodeProviderFromGlobal(): MpLoginCodeProvider {
  return createWeixinLoginCodeProvider(readWeixinLoginApi().login);
}
