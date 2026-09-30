import {
  getSdkworkCommerceService,
  unwrapSdkworkCommerceResponse,
} from "@sdkwork/mall-commerce-service";

export interface MallH5Address {
  addressLine: string;
  id: string;
  isDefault: boolean;
  receiverName: string;
  receiverPhone: string;
}

export interface MallH5AddressInput {
  addressLine: string;
  receiverName: string;
  receiverPhone: string;
}

function readAddress(item: Record<string, unknown>): MallH5Address {
  return {
    addressLine: String(item.addressLine ?? item.detailAddress ?? item.address ?? ""),
    id: String(item.id ?? ""),
    isDefault: item.isDefault === true || item.is_default === true,
    receiverName: String(item.receiverName ?? item.contactName ?? ""),
    receiverPhone: String(item.receiverPhone ?? item.contactPhone ?? ""),
  };
}

export async function listMallH5Addresses(): Promise<MallH5Address[]> {
  const response = await getSdkworkCommerceService().addresses.list({ page: 1, page_size: 50 });
  const payload = unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(response) ?? {};
  return (payload.items ?? []).map(readAddress);
}

export async function createMallH5Address(input: MallH5AddressInput): Promise<void> {
  await getSdkworkCommerceService().addresses.create({ ...input });
}

export async function updateMallH5Address(addressId: string, input: MallH5AddressInput): Promise<void> {
  await getSdkworkCommerceService().addresses.update(addressId, { ...input });
}

export async function deleteMallH5Address(addressId: string): Promise<void> {
  await getSdkworkCommerceService().addresses.delete(addressId);
}

export async function setDefaultMallH5Address(addressId: string): Promise<void> {
  await getSdkworkCommerceService().addresses.defaultSelection.create({ addressId });
}
