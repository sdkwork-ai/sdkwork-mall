import { unwrapSdkworkPaymentResponse } from "@sdkwork/payment-service";
import { currentMallAccountScopeId } from "@sdkwork/mall-pc-core/session";

import {
  defaultMallCmsConfig,
  type MallCmsConfig,
  writeMallCmsConfig,
} from "./cms-config";
import { getSdkworkCmsRemotePort } from "./cms-remote-port";

export const MALL_CMS_OFFER_MARKER = "sdkwork-mall-pc-cms-config";

/**
 * The loaded configuration is cached per tenant+account. The previous tenant's
 * cache must not be served to the next admin session, so every read compares
 * the scope and drops a stale entry.
 */
let cachedConfig: { scopeId: string; config: MallCmsConfig } | null = null;

function readScopedCachedConfig(): MallCmsConfig | null {
  if (!cachedConfig) {
    return null;
  }
  if (cachedConfig.scopeId !== currentMallAccountScopeId()) {
    cachedConfig = null;
    return null;
  }
  return cachedConfig.config;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMallCmsConfigPayload(value: unknown): MallCmsConfig | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return parseMallCmsConfigPayload(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (!isRecord(value)) {
    return null;
  }

  if (Array.isArray(value.banners) && Array.isArray(value.floors) && Array.isArray(value.hotKeywords)) {
    return {
      ...defaultMallCmsConfig(),
      ...value,
      banners: value.banners as MallCmsConfig["banners"],
      floors: value.floors as MallCmsConfig["floors"],
      hotKeywords: value.hotKeywords as MallCmsConfig["hotKeywords"],
      updatedAt: String(value.updatedAt ?? new Date().toISOString()),
    };
  }

  return null;
}

function readOfferCmsPayload(offer: Record<string, unknown>): MallCmsConfig | null {
  const candidates = [
    offer.cmsConfigJson,
    offer.cms_config_json,
    offer.metadataJson,
    offer.metadata_json,
    offer.ruleJson,
    offer.rule_json,
    offer.description,
    offer.summary,
  ];

  for (const candidate of candidates) {
    const parsed = parseMallCmsConfigPayload(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function isMallCmsOffer(offer: Record<string, unknown>): boolean {
  const marker = [
    offer.code,
    offer.offerCode,
    offer.offer_code,
    offer.title,
    offer.name,
    offer.slug,
  ]
    .map((value) => String(value ?? ""))
    .join(" ")
    .toLowerCase();

  return marker.includes(MALL_CMS_OFFER_MARKER);
}

function serializeMallCmsOfferBody(config: MallCmsConfig): Record<string, unknown> {
  const payload = JSON.stringify(config);
  return {
    code: MALL_CMS_OFFER_MARKER,
    description: payload,
    metadataJson: { cmsConfig: config },
    ruleJson: { cmsConfig: config },
    status: "active",
    title: "商城 CMS 配置",
  };
}

async function findAdminCmsOffer(): Promise<{ id: string; record: Record<string, unknown> } | null> {
  const remote = getSdkworkCmsRemotePort();
  const response = await remote.listAdminPromotionOffers({ page: 1, page_size: 50 });
  const payload = unwrapSdkworkPaymentResponse(response) as { items?: Record<string, unknown>[] };
  const offer = payload.items?.find(isMallCmsOffer);
  if (!offer) {
    return null;
  }
  return { id: String(offer.id ?? ""), record: offer };
}

async function findStorefrontCmsOffer(): Promise<Record<string, unknown> | null> {
  const remote = getSdkworkCmsRemotePort();
  const response = await remote.listStorefrontPromotionOffers({ page: 1, page_size: 50, status: "active" });
  const payload = unwrapSdkworkPaymentResponse(response) as { items?: Record<string, unknown>[] };
  return payload.items?.find(isMallCmsOffer) ?? null;
}

export async function loadMallCmsConfigRemote(): Promise<MallCmsConfig> {
  const cached = readScopedCachedConfig();
  if (cached) {
    return cached;
  }

  try {
    const offer = await findStorefrontCmsOffer();
    if (offer) {
      const remoteConfig = readOfferCmsPayload(offer);
      if (remoteConfig) {
        cachedConfig = { scopeId: currentMallAccountScopeId(), config: remoteConfig };
        writeMallCmsConfig(remoteConfig);
        return remoteConfig;
      }
    }
  } catch {
    // Remote CMS is optional; local fallback remains available.
  }

  return defaultMallCmsConfig();
}

export async function saveMallCmsConfigRemote(config: MallCmsConfig): Promise<MallCmsConfig> {
  const nextConfig = { ...config, updatedAt: new Date().toISOString() };
  writeMallCmsConfig(nextConfig);
  cachedConfig = { scopeId: currentMallAccountScopeId(), config: nextConfig };

  try {
    const remote = getSdkworkCmsRemotePort();
    const existing = await findAdminCmsOffer();
    const body = serializeMallCmsOfferBody(nextConfig);

    if (existing?.id) {
      await remote.updateAdminPromotionOffer(existing.id, body);
    } else {
      await remote.createAdminPromotionOffer(body);
    }
  } catch {
    // Persist locally even when admin API is unavailable in dev.
  }

  return nextConfig;
}

export function invalidateMallCmsConfigCache() {
  cachedConfig = null;
}
