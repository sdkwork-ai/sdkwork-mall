# `@sdkwork/mall-mp-auth`

Account capability for the SDKWork Mall mini program.

Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 7-8,
`IAM_LOGIN_INTEGRATION_SPEC.md` sections 3-5. Authentication belongs to SDKWork
IAM; this capability only projects it.

## What it owns

| Entry | IAM block | Purpose |
| --- | --- | --- |
| `loginWithWechat()` | `wx.login()` → `oauth.miniProgramSessions.create` | production sign-in; the buyer types nothing |
| `loginWithPassword()` | `auth.sessions.create` (`grantType: "password"`) | fallback for accounts without a WeChat binding |
| `loadCurrentUser()` | `iam.users.current.retrieve` | identity for the profile and security screens |
| `changePassword()` | `iam.users.current.password.update` | credential change; IAM owns the policy |
| `logout()` | `auth.sessions.current.delete` + local clear | revoke failure never traps the buyer |
| `restore()` | `auth.sessions.current.retrieve` | cold launch; only a 401/403 clears the session |

`detectPrincipalKind()` maps an account string onto the IAM principal field
(`email` / `phone` / `username`).

## Usage

```ts
const auth = createMpAuthService(getMallMpRuntime());
await auth.loginWithWechat();
const user = await auth.loadCurrentUser();
```

## Rules

- Builds no SDK client and assembles no auth header: both arrive through the
  injected runtime.
- No hand-written `/auth/*` or `/iam/*` path: `tests/contract/verify-mp-auth-block-integration.test.mjs`
  fails the build if one appears in the app or in a capability package.
