# ADR 0001 — TV Client Root Deferred

Status: accepted (deferral upheld); amended 2026-10-02 — a TV **entry surface**
ships inside the H5 root at `/tv` while the dedicated TV client root remains
deferred
Date: 2026-09-30
Owner: SDKWork Mall maintainers
Authority: `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` §2.3, `GOVERNANCE_SPEC.md`,
`UI_ARCHITECTURE_SPEC.md`

## Context

The mall product goal includes aligning with professional TV shopping
applications (JD.com-style ten-foot UI). The cross-client architecture
registry (`APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` §2.3) explicitly marks
the TV / set-top client pattern as **deferred**, and forbids implementing a
deferred pattern as an unregistered application root or ad-hoc
`clientArchitectures` value. Adopting TV requires, in order: an ADR (this
document family), a new root standard in `sdkwork-specs`, `TEST_SPEC.md`
validation rows, and registration in the §2 registry and
`UI_ARCHITECTURE_SPEC.md`.

## Decision

SDKWork Mall ships **no** `apps/sdkwork-mall-tv` root in this phase. The TV
experience is not implemented as an ad-hoc web build, a stripped PC build, or
an unregistered root. The mall's browser roots (PC + H5) remain the only
registered surfaces until the TV root standard is adopted through governance.

## Adoption path (when TV work is funded)

1. Author the TV root standard (`APP_TV_ARCHITECTURE_SPEC.md`) in
   `sdkwork-specs`, covering root naming (`apps/sdkwork-<code>-tv`), package
   taxonomy (`-tv-core/-commons/-shell/-<capability>`), remote-control focus
   model, and ten-foot UI interaction rules.
2. Add `TEST_SPEC.md` validation rows and register the TV row in
   `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` §2 and
   `UI_ARCHITECTURE_SPEC.md`.
3. Add the `tv` app type to `MODULE_BIN_SPEC.md` §4.3 and wire
   `SDKWORK_APP_TYPES` + build/package hooks in `bin/lib/module.sh`.
4. Create `apps/sdkwork-mall-tv` following the new standard, reusing
   `@sdkwork/mall-commerce-sdk-ports` / `@sdkwork/mall-commerce-service` as the
   shared headless anchors, with route ids aligned to the registry.

## Consequences

- The mall cannot be distributed as a TV application today; this is a
  deliberate, spec-compliant gap, not an oversight.
- Storefront services and route ids stay client-agnostic so the future TV root
  consumes the same headless layer without forking.

## Amendment (2026-10-02)

Product direction requires a JD-style TV entry now. Rather than standing up an
unregistered TV application root (forbidden by the deferred-pattern rule), the
H5 browser root ships a **TV surface** at route `storefront.mall.tv` (`/tv`,
package `@sdkwork/mall-h5-home`): a ten-foot UI (dark theme, large type,
category rail + product grid) navigated by remote-D-style arrow keys with
Enter/Back equivalents. It consumes the same headless commerce facade as every
other surface, registers through the standard route registry, and hides the
mobile shell chrome on that path only. The dedicated `apps/sdkwork-mall-tv`
client root remains deferred and still requires the §Adoption-path governance
steps before it may be created.
