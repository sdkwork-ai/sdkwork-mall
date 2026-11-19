import { getSdkworkCommerceService } from "@sdkwork/mall-commerce-service";
import { configureSdkworkActivityRemotePort } from "@sdkwork/mall-pc-activity";
import { configureSdkworkCatalogRemotePort } from "@sdkwork/mall-pc-catalog";
import { configureSdkworkHomeRemotePort } from "@sdkwork/mall-pc-home";
import { configureSdkworkSearchRemotePort } from "@sdkwork/mall-pc-search";
import { configureSdkworkShopRemotePort } from "@sdkwork/mall-pc-shop";

export function configureSdkworkMallPcStorefrontCommerceRemotePorts(): void {
  const commerce = () => getSdkworkCommerceService();

  configureSdkworkShopRemotePort({
    listShops(query) {
      return commerce().shops.list(query);
    },
    retrieveShop(query) {
      // Generated path-parameter commands take (id) strings, not query
      // objects — an object serializes into the path and 404s.
      return commerce().shops.retrieve(query.shopId);
    },
  });

  configureSdkworkHomeRemotePort({
    listCategories(query) {
      return commerce().catalog.categories.list(query);
    },
    listSpus(query) {
      // The catalog authority publishes the storefront collection as `products`
      // (`/app/v3/api/catalog/products`); the retired `spus` collection is not a
      // route the gateway route manifest carries, so calling it answers 40401.
      return commerce().catalog.products.list(query);
    },
    listShops(query) {
      return commerce().shops.list(query);
    },
  });

  configureSdkworkSearchRemotePort({
    listCategories(query) {
      return commerce().catalog.categories.list(query);
    },
    listProducts(query) {
      return commerce().catalog.products.list(query);
    },
    listSpus(query) {
      return commerce().catalog.products.list(query);
    },
    listShops(query) {
      return commerce().shops.list(query);
    },
  });

  configureSdkworkCatalogRemotePort({
    createCartItem(body) {
      return commerce().cart.items.create(body);
    },
    updateCartItem(cartItemId, body) {
      return commerce().cart.items.update(cartItemId, body);
    },
    listPromotionOffers(query) {
      return commerce().promotions.offers.list(query);
    },
    retrieveCategory(query) {
      return commerce().catalog.categories.retrieve(query.categoryId);
    },
    retrieveSpu(query) {
      // `retrieveSpu` is the storefront's name for a product record; the
      // published collection path is `/catalog/products/{productId}`.
      return commerce().catalog.products.retrieve(query.spuId);
    },
  });

  configureSdkworkActivityRemotePort({
    listPromotionOffers(query) {
      return commerce().promotions.offers.list(query);
    },
    retrievePromotionOffer(query) {
      return commerce().promotions.offers.retrieve(query.offerId);
    },
  });
}
