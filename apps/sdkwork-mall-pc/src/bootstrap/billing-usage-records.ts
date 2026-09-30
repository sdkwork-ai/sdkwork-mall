import {
  getSdkworkCommerceService,
  unwrapSdkworkCommerceResponse,
} from "@sdkwork/mall-commerce-service";
import {
  toSdkworkPaymentNumber,
  toSdkworkPaymentOptionalString,
} from "@sdkwork/payment-service";

interface SdkworkBillingUsageRecord {
  capability: string;
  costCny: number;
  id: string;
  model: string;
  provider: string;
  title: string;
  unitLabel: string;
  units: number;
  usageAt: string;
  workspace: string;
}

export interface LoadSdkworkBillingUsageRecordsOptions {
  referenceDate?: string | Date;
}

type SdkworkBillingUsageRecordsLoader = (
  options?: LoadSdkworkBillingUsageRecordsOptions,
) => Promise<SdkworkBillingUsageRecord[]>;

let sdkworkBillingUsageRecordsLoader: SdkworkBillingUsageRecordsLoader | null = null;

function configureSdkworkBillingUsageRecordsLoader(
  loader: SdkworkBillingUsageRecordsLoader | null,
): void {
  sdkworkBillingUsageRecordsLoader = loader;
}

interface RemoteUsageRecord {
  capability?: string;
  cost?: number | string;
  costAmount?: number | string;
  costCny?: number | string;
  id?: string;
  model?: string;
  provider?: string;
  title?: string;
  unitLabel?: string;
  units?: number | string;
  usageAt?: string;
  workspace?: string;
}

interface RemoteUsageListEnvelope {
  content?: RemoteUsageRecord[];
  items?: RemoteUsageRecord[];
}

const DEFAULT_CAPABILITY = "general";
const DEFAULT_MODEL = "default";
const DEFAULT_PROVIDER = "platform";
const DEFAULT_USAGE_TITLE = "Usage";
const DEFAULT_UNIT_LABEL = "units";
const DEFAULT_WORKSPACE = "default";

function mapRemoteUsageRecord(
  record: RemoteUsageRecord,
  index: number,
): SdkworkBillingUsageRecord {
  return {
    capability: toSdkworkPaymentOptionalString(record.capability) || DEFAULT_CAPABILITY,
    costCny: Math.max(0, toSdkworkPaymentNumber(record.costCny ?? record.costAmount ?? record.cost)),
    id: toSdkworkPaymentOptionalString(record.id) || `usage-${index + 1}`,
    model: toSdkworkPaymentOptionalString(record.model) || DEFAULT_MODEL,
    provider: toSdkworkPaymentOptionalString(record.provider) || DEFAULT_PROVIDER,
    title: toSdkworkPaymentOptionalString(record.title) || toSdkworkPaymentOptionalString(record.model) || DEFAULT_USAGE_TITLE,
    unitLabel: toSdkworkPaymentOptionalString(record.unitLabel) || DEFAULT_UNIT_LABEL,
    units: Math.max(0, Math.round(toSdkworkPaymentNumber(record.units))),
    usageAt: toSdkworkPaymentOptionalString(record.usageAt) || new Date(0).toISOString(),
    workspace: toSdkworkPaymentOptionalString(record.workspace) || DEFAULT_WORKSPACE,
  };
}

export function createCommerceBillingUsageRecordsLoader(): SdkworkBillingUsageRecordsLoader {
  return async (options: LoadSdkworkBillingUsageRecordsOptions = {}) => {
    const payload = unwrapSdkworkCommerceResponse<RemoteUsageListEnvelope | RemoteUsageRecord[] | null>(
      await getSdkworkCommerceService().billing.history.list({
        referenceDate:
          typeof options.referenceDate === "string"
            ? options.referenceDate
            : options.referenceDate instanceof Date
            ? options.referenceDate.toISOString()
            : undefined,
      }),
      "Failed to load billing usage records.",
    );

    const records = Array.isArray(payload)
      ? payload
      : payload?.items ?? payload?.content ?? [];

    return records.map((record, index) => mapRemoteUsageRecord(record, index));
  };
}

export function configureSdkworkMallPcBillingUsageRecordsLoader(): void {
  configureSdkworkBillingUsageRecordsLoader(createCommerceBillingUsageRecordsLoader());
}
