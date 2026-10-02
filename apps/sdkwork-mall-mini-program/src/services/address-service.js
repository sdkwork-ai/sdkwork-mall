const { request } = require("./transport");

async function listAddresses() {
  const payload = await request({ path: "/addresses", query: { page: 1, page_size: 20 } });
  return (payload.items ?? []).map((item) => ({
    id: String(item.id ?? ""),
    receiverName: String(item.receiverName ?? item.contactName ?? ""),
    receiverPhone: String(item.receiverPhone ?? item.contactPhone ?? ""),
    addressLine: String(item.addressLine ?? item.detailAddress ?? item.address ?? ""),
    isDefault: item.isDefault === true || item.is_default === true,
  }));
}

async function createAddress(options) {
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

async function updateAddress(addressId, options) {
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

async function deleteAddress(addressId) {
  return request({ path: `/addresses/${addressId}`, method: "DELETE" });
}

async function setDefaultAddress(addressId) {
  return request({ path: "/addresses/default_selection", method: "POST", body: { addressId } });
}

module.exports = { listAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress };
