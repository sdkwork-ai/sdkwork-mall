# i18n Readiness

Status: assessment (migration not started)
Owner: SDKWork maintainers
Updated: 2026-11-02
Specs: I18N_SPEC.md, FRONTEND_CODE_SPEC.md, APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md

## 1. Current State

`pnpm audit:i18n` (reproducible; run it instead of trusting these numbers for
long):

| Root | i18n mechanism | Files with copy | Hard-coded strings | Locale data (excluded) |
| --- | --- | --- | --- | --- |
| PC | i18next + per-package `*-copy.ts` and `commerce-intl.tsx`; route `titleKey` | 120 | 1620 | 0 |
| H5 | none — literal zh-CN | 68 | 540 | 390 (`regions.ts`) |
| Mini program | none — literal zh-CN | 66 | 339 | 302 (province/city picker data) |
| Flutter | none — literal zh-CN | 38 | 517 | 230 (province/city picker data) |

3016 user-facing strings remain hard-coded. The PC root has the mechanism but
still mixes literal copy into pages (its five biggest hotspots are 227, 128, 106,
79 and 71 strings), and the mobile roots have no mechanism at all.

## 2. What Already Exists

The migration does not start from zero:

- **Canonical capability labels** — `specs/mall-capability-parity.json` owns the
  canonical screen name of all 36 capabilities, enforced across roots by the
  parity gate (`every root shows the same capability title to the user`).
- **Shared notices** — the upstream-review and gift-card statements are already
  declared once under `sharedCopy` with byte-exact enforcement.
- **Route title keys** — PC/H5 route contributions carry
  `<namespace>.routes.<screen>.title` keys, validated by the parity gate.
- **PC catalogue precedent** — `*-copy.ts` modules prove the per-domain
  catalogue shape the other roots need.

## 3. Key Strategy

Keys are derived from capability ids, not from file paths, so all four roots can
share one vocabulary:

```text
capability.<capability-id>.title      # 我的评价 / My reviews
capability.<capability-id>.empty      # empty-state sentence
capability.<capability-id>.action     # primary action label
common.retry | common.confirm | common.cancel | common.loading
upstream.<capability-id>.pending      # the shared upstream-notice statements
```

`capability.*` values are generated from the parity contract, so a capability
cannot be renamed on one root without the catalogue changing for all of them.

## 4. Staged Path

**S1 — shared capability layer (small, no UI churn).**
Generate `specs/app-i18n/capabilities.<locale>.json` from
`specs/mall-capability-parity.json` (title + shared notices). Wire each root's
route/page title lookup to it. This removes duplicate literals for the 36 screen
names and the two upstream notices, and makes future locale additions a
catalogue drop rather than a code change.

**S2 — per-root message catalogues.**
Introduce the runtime for the three roots without one (H5: i18next to match PC;
mini program: a typed message map loaded once into `app.ts`; Flutter:
`flutter_localizations` + an ARB-derived message map). Migrate in hotspot order,
highest first, keeping the existing `sdkwork` prefix conventions.

**S3 — locale switching and verification.**
Locale store per root, `Accept-Language` propagation through the transport seams,
and a pseudo-locale render check in the Flutter visual harness plus a `zh-CN`
baseline snapshot for H5.

## 5. Non-Goals For Now

- No bulk extraction of all 3016 strings in one change: without runtime
  verification on H5/PC (the root build is blocked upstream, see
  `TECH-CLIENT-CAPABILITY-PARITY.md` §5), a mass rename is unverifiable.
- Do not translate locale data (province/city lists); it is data, not copy.
- Do not introduce a second key vocabulary next to the capability ids.

## 6. Verification

| Step | Gate |
| --- | --- |
| Numbers refresh | `pnpm audit:i18n` (no diff expected unless copy changed) |
| S1 catalogue | snapshot + parity gate both read the same contract |
| S2 per root | existing architecture gates per root, plus catalogue reachability test |
| S3 locale switch | Flutter visual capture with the pseudo-locale; H5 baseline screenshot |
