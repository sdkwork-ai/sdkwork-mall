import { request } from "./transport";

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

export async function listAddresses(): Promise<MpAddress[]> {
  const payload = await request({ path: "/addresses", query: { page: 1, page_size: 20 } });
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items.map((item) => ({
    id: String(item.id ?? ""),
    receiverName: String(item.receiverName ?? item.contactName ?? ""),
    receiverPhone: String(item.receiverPhone ?? item.contactPhone ?? ""),
    addressLine: String(item.addressLine ?? item.detailAddress ?? item.address ?? ""),
    isDefault: item.isDefault === true || item.is_default === true,
  }));
}

export async function createAddress(options: MpAddressInput): Promise<Record<string, unknown>> {
  return request({
    path: "/addresses",
    method: "POST",
    body: {
      addressLine: options.addressLine,
      receiverName: options.receiverName,
      receiverPhone: options.receiverPhone,
    },
  });
}

export async function updateAddress(addressId: string, options: MpAddressInput): Promise<Record<string, unknown>> {
  return request({
    path: `/addresses/${addressId}`,
    method: "PUT",
    body: {
      addressLine: options.addressLine,
      receiverName: options.receiverName,
      receiverPhone: options.receiverPhone,
    },
  });
}

export async function deleteAddress(addressId: string): Promise<Record<string, unknown>> {
  return request({ path: `/addresses/${addressId}`, method: "DELETE" });
}

export async function setDefaultAddress(addressId: string): Promise<Record<string, unknown>> {
  return request({ path: "/addresses/default_selection", method: "POST", body: { addressId } });
}
