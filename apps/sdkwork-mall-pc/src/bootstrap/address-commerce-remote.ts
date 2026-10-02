import {
  getSdkworkCommerceService,
} from "@sdkwork/mall-commerce-service";
import {
  configureSdkworkAddressRemotePort,
  type SdkworkAddressInput,
  type SdkworkAddressRemotePort,
} from "@sdkwork/mall-pc-address";

export function createCommerceAddressRemotePort(): SdkworkAddressRemotePort {
  const commerce = () => getSdkworkCommerceService();

  return {
    listAddresses() {
      return commerce().addresses.list({});
    },
    createAddress(body: SdkworkAddressInput) {
      return commerce().addresses.create(body);
    },
    updateAddress(addressId, body) {
      return commerce().addresses.update(addressId, body);
    },
    deleteAddress(addressId) {
      return commerce().addresses.delete(addressId);
    },
    setDefaultAddress(addressId) {
      // Generated signature: create(addressId, body) — path parameter, not body.
      return commerce().addresses.defaultSelection.create(addressId, {});
    },
  };
}

export function configureSdkworkMallPcAddressRemotePort(): void {
  configureSdkworkAddressRemotePort(createCommerceAddressRemotePort());
}
