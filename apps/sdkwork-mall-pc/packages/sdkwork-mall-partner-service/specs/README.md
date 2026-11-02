# Partner Service Specs

Machine authority: `component.spec.json`.

- `partner-types.ts` owns the distribution vocabulary and the optional
  partner-center projection.
- `partner-domain.ts` owns pure, locale-neutral rules (membership resolution,
  draft validation issue codes, invite-link composition, display formatting).
- `partner-sdk-port.ts` is the only file that imports `@sdkwork/partner-app-sdk`.
- `partner-service.ts` composes the join port plus the optional center port.

Rule: no user-facing copy in this package. Clients map issue codes and states to
their own i18n catalogues.
