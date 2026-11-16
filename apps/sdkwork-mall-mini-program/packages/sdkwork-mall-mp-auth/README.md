# `@sdkwork/mall-mp-auth`

Account capability for the SDKWork Mall mini program.

Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 7-8,
`IAM_LOGIN_INTEGRATION_SPEC.md` sections 3-5.

## What it owns

| Entry | Path | Purpose |
| --- | --- | --- |
| `loginWithWechat()` | `wx.login()` → `oauth.miniProgramSessions.create` | production sign-in; the buyer types nothing |
| `loginWithPassword()` | `POST /auth/sessions` via the core request seam | fallback for accounts without a WeChat binding |
| `logout()` | IAM session revoke + local clear | revoke failure never traps the buyer |
| `restore()` | `auth.sessions.current.retrieve` | cold launch; only a 401/403 clears the session |

`detectPrincipalKind()` maps an account string onto the IAM principal field
(`email` / `phone` / `username`).

## Usage

```ts
const auth = createMpAuthService(getMallMpRuntime());
await auth.loginWithWechat();
```

## Rules

- Builds no SDK client and assembles no auth header: both arrive through the
  injected runtime.
- The dev-only token paste stays in the login page and out of the dual-token
  store, so a half session never reaches a generated SDK.
