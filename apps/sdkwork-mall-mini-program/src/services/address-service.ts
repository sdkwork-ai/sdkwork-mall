/**
 * Buyer address book.
 *
 * Authority: `TECH-BLOCK-INTEGRATION.md` (addresses row). The address book belongs
 * to the mall commerce block (`runtime.commerceClient.addresses`); this module
 * projects it and owns no wire path.
 */
import { getMallMpRuntime } from "@sdkwork/mall-mp-core";

export interface MpAddress {
  addressLine: string;
  id: string;
  isDefault: boolean;
  receiverName: string;
  receiverPhone: string;
}

export interface MpAddressInput {
  addressLine: string;
  receiverName: string;
  receiverPhone: string;
}

function addresses() {
  return getMallMpRuntime().commerceClient.addresses;
}

async function readCommerceData(call: Promise<{ data: Record<string, unknown> }>): Promise<Record<string, unknown>> {
  const result = await call;
  return (result?.data ?? {}) as Record<string, unknown>;
}

function readRows(record: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(record.items)) {
    return record.items as Array<Record<string, unknown>>;
  }
  if (Array.isArray(record.content)) {
    return record.content as Array<Record<string, unknown>>;
  }
  return [];
}

export async function listAddresses(): Promise<MpAddress[]> {
  const payload = await readCommerceData(addresses().list({ page: 1, pageSize: 20 }));
  return readRows(payload).map((item) => ({
    id: String(item.id ?? ""),
    receiverName: String(item.receiverName ?? item.contactName ?? ""),
    receiverPhone: String(item.receiverPhone ?? item.contactPhone ?? ""),
    addressLine: String(item.addressLine ?? item.detailAddress ?? item.address ?? ""),
    isDefault: item.isDefault === true || item.is_default === true,
  }));
}

export async function createAddress(options: MpAddressInput): Promise<Record<string, unknown>> {
  return readCommerceData(addresses().create({
    addressLine: options.addressLine,
    receiverName: options.receiverName,
    receiverPhone: options.receiverPhone,
  }));
}

export async function updateAddress(addressId: string, options: MpAddressInput): Promise<Record<string, unknown>> {
  return readCommerceData(addresses().update(addressId, {
    addressLine: options.addressLine,
    receiverName: options.receiverName,
    receiverPhone: options.receiverPhone,
  }));
}

export async function deleteAddress(addressId: string): Promise<Record<string, unknown>> {
  return readCommerceData(addresses().delete(addressId));
}

export async function setDefaultAddress(addressId: string): Promise<Record<string, unknown>> {
  return readCommerceData(addresses().defaultSelection.create(addressId, {}));
}
