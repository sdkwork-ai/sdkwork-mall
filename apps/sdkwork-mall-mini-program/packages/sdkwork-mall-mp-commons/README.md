# `@sdkwork/mall-mp-commons`

Domain-neutral primitives shared by every mall mini-program capability.

Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 3.

## What it owns

- `records.ts` — coercion for loose wire records the legacy commerce endpoints and
  the federation chat plane still return (`asRecord`, `asRecordList`, `asString`,
  `asNumber`, `asBoolean`, `asEpochMillis`).
- `errors.ts` — one place that turns a failure into a buyer-readable sentence and
  that classifies auth rejections (`errorMessage`, `isAuthorizationError`).

## Rules

- No SDK construction, no business rules, no page or component code.
- Everything here is deterministic and synchronously testable.
