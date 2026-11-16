# `@sdkwork/mall-mp-core`

Runtime composition for the SDKWork Mall mini program.

Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 1, 3, 6 and 7.

## What it owns

- **runtime**: `initializeMallMpRuntime({ environment, host })` binds one
  environment document, one host profile, the domain session module and the
  generated clients; `getMallMpRuntime()` is the only global it publishes.
- **session**: a thin adapter over the **SDKWork IAM** module
  (`@sdkwork/iam-mp-core/session-wechat`). Session persistence, the token-manager
  twin, the WeChat exchange and cold-launch revalidation are IAM's; this package
  only injects the host storage and re-exports the surface.
- **sdk**: factories for the generated clients — `@sdkwork/iam-app-sdk` (auth),
  `@sdkwork/im-app-sdk` (notices) and `@sdkwork/im-sdk` (conversations/messages).
- **request**: the commerce `/app/v3/api` seam — envelope unwrap, dual-token
  headers, timeout and `application/problem+json` mapping.
- **composition**: the module/SDK/host inventory plus
  `validateMallMpComposition()`, which fails a launch that misses a required key
  or host capability.
- **platform**: the page-facing facade (`platform.toast/navigateTo/confirm/
  copy/chooseImages/previewImages/requestPayment/stopPullDownRefresh/storage`).
  Pages call this instead of assembling platform option literals; every method
  resolves the installed host per call.
- **host**: the installed host accessor for capability packages.

## Domain ownership

| Concern | Owner | Mall's role |
| --- | --- | --- |
| Authentication / WeChat session | `sdkwork-iam` (`@sdkwork/iam-mp-core`) | inject host storage, construct the generated IAM client |
| Notices, inbox, conversations | `sdkwork-im` (`@sdkwork/im-mp-chat`) | construct the generated IM clients, compose the services |
| Host platform APIs | this app (`@sdkwork/mall-mp-host`) | implement the WeChat profile |
| Commerce app-api | this app | own the envelope seam |

## Rules

- Imports `@sdkwork/mall-mp-host`, generated app SDKs and the IAM mini-program
  session module only.
- No platform globals: the network hop is the injected `MpHttpClient`.
- Never constructs a session outside the IAM store; clearing must clear storage,
  the token manager and the in-memory snapshot together.
