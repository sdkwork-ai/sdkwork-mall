/**
 * Share-attribution seam.
 *
 * A storefront page may offer "share this product"; when the signed-in visitor is
 * a distributor the link must carry their invite code so the order attributes.
 * The H5 root owns the partner service, so it registers the resolver here once and
 * feature bricks stay independent of the partner package.
 */
type ShareAttributionResolver = () => Promise<string>;

let resolver: ShareAttributionResolver | null = null;

export function registerShareAttributionResolver(next: ShareAttributionResolver | null): void {
  resolver = next;
}

/** The distributor's invite code, or "" when unknown/unavailable. */
export async function resolveShareAttribution(): Promise<string> {
  if (!resolver) {
    return "";
  }
  try {
    return (await resolver()).trim();
  } catch {
    return "";
  }
}
