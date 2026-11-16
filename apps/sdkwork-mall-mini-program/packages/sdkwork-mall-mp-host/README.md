# `@sdkwork/mall-mp-host`

WeChat mini-program host adapters for the SDKWork Mall mini program.

Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 3 and 8.

## What it owns

Every platform API the app needs, behind typed contracts, with one WeChat
profile and an in-memory fake:

| Contract | WeChat implementation | Notes |
| --- | --- | --- |
| `MpLoginCodeProvider` | `wx.login` | the one-time code is never logged or persisted |
| `MpStorage` | `wx.setStorageSync` | session-safe key/value storage |
| `MpNavigation` | `wx.navigateTo/switchTab/redirectTo/navigateBack` | promise-shaped, stable error codes, EventChannel pass-through |
| `MpFeedback` / `MpClipboard` | `wx.showToast/showModal` / `wx.setClipboardData` | tone-aware toast, confirm resolves a boolean |
| `MpLifecycle` | `wx.start/stopPullDownRefresh` | ends the spinner without throwing |
| `MpDeviceInfo` | `wx.getAccountInfoSync` | the release channel the fallback host depends on |
| `MpHttpClient` | `wx.request` | the only platform network hop in the app |
| `MpMediaPicker` | `wx.chooseMedia` / `previewImage` / `FileSystemManager` | bytes and preview only; Drive owns uploads |
| `MpPaymentBridge` | `wx.requestPayment` | a dismissed cashier is `cancelled`, not a failure |
| `MpSocket` | `wx.connectSocket` | tracks `readyState` itself and replays an early `open`, because the IM realtime SDK subscribes after the task exists |

## Usage

```ts
import { createWeixinHost } from "@sdkwork/mall-mp-host/weixin";

const host = createWeixinHost(); // installed by app.ts through the core runtime
```

Pages do not import this package. They call the facade in `@sdkwork/mall-mp-core`:

```ts
import { platform } from "@sdkwork/mall-mp-core";

platform.toast("已加入购物车", "success");
platform.navigateTo(url, { fallbackUrl: cartUrl });
platform.stopPullDownRefresh();
```

```ts
import { createMemoryHost } from "@sdkwork/mall-mp-host/testing";

const host = createMemoryHost({ httpResponses: [{ statusCode: 200, header: {}, data: { code: 0, data: {} } }] });
```

## Rules

- Business packages never import this package's `weixin` subpath; they receive
  `MpHost` from `@sdkwork/mall-mp-core`.
- A missing platform API reports `unsupported` instead of throwing a raw
  `TypeError`, so the bootstrap can keep a development fallback alive.
