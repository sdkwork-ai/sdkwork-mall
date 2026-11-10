/**
 * `sdkwork-merchandise` authority vocabulary and wire-shape helpers.
 *
 * The merchandise capability owner (`sdkwork-merchandise`) fixes the write
 * contract for the backend catalog module
 * (`apis/backend-api/merchandise/shop-backend-api.merchandise.openapi.json`):
 * every write body is closed (`additionalProperties: false`), identifiers and
 * amounts ride the int64-as-string rules (`API_SPEC` §13.6, prices in minor
 * units per `API_SPEC` §13.2.1), and the vocabularies below are the authority
 * sets (`ck_commerce_product_spu_product_type`,
 * `ck_commerce_product_sku_fulfillment_type`, `ck_commerce_product_spu_status`).
 *
 * Read helpers stay tolerant: records written by the retired legacy commerce
 * contract (`physical_good`, `physical_shipment`, decimal amounts, …) still
 * load, but every write emits authority values only.
 */

export type MerchandiseProductType = 'physical' | 'digital' | 'service' | 'membership' | 'points';

export type MerchandiseSkuFulfillmentType =
  | 'physical'
  | 'digital'
  | 'service'
  | 'membership_activation'
  | 'points_topup';

export type MerchandiseLifecycleStatus = 'draft' | 'active' | 'inactive' | 'archived';

const RETIRED_PRODUCT_TYPE_MAP: Readonly<Record<string, MerchandiseProductType>> = {
  physical_good: 'physical',
  virtual_good: 'digital',
  // A wallet recharge is delivered digitally; the authority set has no wallet
  // product type, so the digital carrier is the conforming fallback.
  wallet_recharge: 'digital',
  // Subscription delivery collapses onto the closest authority carrier: a
  // recurring service.
  subscription: 'service',
};

/**
 * Maps any stored product type onto the authority set.
 *
 * Authority values pass through; retired legacy values (`physical_good`,
 * `virtual_good`, `points_recharge`, `wallet_recharge`, `subscription`) are
 * carried by {@link RETIRED_PRODUCT_TYPE_MAP}; unknown values fall back to
 * `physical`, the console default.
 */
export function normalizeMerchandiseProductType(value: unknown): MerchandiseProductType {
  if (typeof value !== 'string') {
    return 'physical';
  }
  const candidate = value.trim();
  if (candidate === 'physical' || candidate === 'digital' || candidate === 'service' || candidate === 'membership' || candidate === 'points') {
    return candidate;
  }
  return RETIRED_PRODUCT_TYPE_MAP[candidate] ?? 'physical';
}

/**
 * Default SKU fulfillment for one authority product type:
 * `membership` products activate entitlements, `points` products top up
 * balances, everything else fulfills as its own carrier.
 */
export function defaultFulfillmentTypeForProductType(
  productType: MerchandiseProductType,
): MerchandiseSkuFulfillmentType {
  switch (productType) {
    case 'membership':
      return 'membership_activation';
    case 'points':
      return 'points_topup';
    default:
      return productType;
  }
}

const RETIRED_FULFILLMENT_TYPE_MAP: Readonly<Record<string, MerchandiseSkuFulfillmentType>> = {
  physical_shipment: 'physical',
  digital_delivery: 'digital',
  service_activation: 'service',
  // Entitlement grants and subscription activations both activate a standing
  // entitlement, which the authority carries as `membership_activation`.
  entitlement_grant: 'membership_activation',
  subscription_activation: 'membership_activation',
  points_credit: 'points_topup',
  // A wallet credit is a digital top-up; the authority set has no wallet
  // fulfillment, so the digital carrier is the conforming fallback.
  wallet_credit: 'digital',
};

/**
 * Maps any stored fulfillment type onto the authority set, falling back to the
 * product-type default when the record carries none.
 */
export function normalizeMerchandiseFulfillmentType(
  value: unknown,
  productType: MerchandiseProductType = 'physical',
): MerchandiseSkuFulfillmentType {
  if (typeof value === 'string') {
    const candidate = value.trim();
    if (
      candidate === 'physical'
      || candidate === 'digital'
      || candidate === 'service'
      || candidate === 'membership_activation'
      || candidate === 'points_topup'
    ) {
      return candidate;
    }
    const retired = RETIRED_FULFILLMENT_TYPE_MAP[candidate];
    if (retired) {
      return retired;
    }
  }
  return defaultFulfillmentTypeForProductType(productType);
}

const MINOR_UNIT_EXPONENT = 2;

/**
 * Converts a decimal amount string (`"4299.00"`) into the minor-unit integer
 * string the merchandise contract requires (`"429900"` for CNY fen).
 *
 * Returns `null` when the input is not a valid non-negative decimal, so the
 * caller can omit the field instead of sending an unusable price.
 */
export function decimalAmountToMinorUnits(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,8})?$/u.test(text)) {
    return null;
  }
  const [whole, fraction = ''] = text.split('.');
  const paddedFraction = (fraction + '0'.repeat(MINOR_UNIT_EXPONENT)).slice(0, MINOR_UNIT_EXPONENT);
  const rest = fraction.slice(MINOR_UNIT_EXPONENT);
  if (rest && /[1-9]/u.test(rest)) {
    // Sub-minor precision cannot be represented on the wire.
    return null;
  }
  const minor = `${whole}${paddedFraction}`.replace(/^0+(?=\d)/u, '');
  return minor || '0';
}

/**
 * Renders a minor-unit integer string (`"429900"`) back as the console's
 * decimal amount display (`"4299.00"`).
 *
 * Returns `''` for absent or malformed input; non-negative integers and
 * decimal strings are both accepted so retired records still load.
 */
export function minorUnitsToDecimalAmount(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }
  const text = String(value).trim();
  if (!/^\d+$/u.test(text)) {
    return '';
  }
  if (text.length <= MINOR_UNIT_EXPONENT) {
    return `0.${text.padStart(MINOR_UNIT_EXPONENT, '0')}`;
  }
  return `${text.slice(0, -MINOR_UNIT_EXPONENT)}.${text.slice(-MINOR_UNIT_EXPONENT)}`;
}
