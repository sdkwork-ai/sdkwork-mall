import {
  configureShopMobileCartRuntime,
  type CartItem,
} from "@sdkwork/shop-mobile-react-shopping";

import {
  loadMallH5Cart,
  publishMallH5CartCount,
  removeMallH5CartItem,
  updateMallH5CartItem,
  type MallH5CartLine,
} from "./cart-service";

/** Per-line selection, owned by the cart brick and persisted for the session. */
const selection = new Map<string, boolean>();
let knownCartItemIds: string[] = [];

function toBrickCartItem(line: MallH5CartLine): CartItem {
  const price = line.priceCny != null ? line.priceCny.toFixed(2) : "0.00";
  return {
    id: line.id,
    productId: line.spuId,
    ...(line.shopName ? { shopName: line.shopName } : {}),
    product: {
      id: line.spuId,
      title: line.title,
      price,
      sales: "0",
      image: line.imageUrl ?? "",
      ...(line.shopId ? { shopId: line.shopId } : {}),
    },
    quantity: line.quantity,
    checked: selection.get(line.id) ?? true,
    addedAt: 0,
    ...(line.skuName
      ? {
          sku: {
            id: `${line.id}-sku`,
            specValues: { spec: line.skuName },
            price,
            stock: 0,
          },
        }
      : {}),
  };
}

/**
 * Binds the mall commerce cart facade to the shop cart brick's runtime port.
 *
 * The brick (`@sdkwork/shop-mobile-react-shopping`) owns the cart UI, selection
 * and totals; the mall cart package supplies the data plane from its commerce
 * service (`cart.current` / `cart.items`), so there is no second cart UI.
 */
export function configureSdkworkMallH5CartBrick(): void {
  configureShopMobileCartRuntime({
    async getCart(): Promise<CartItem[]> {
      const snapshot = await loadMallH5Cart();
      knownCartItemIds = snapshot.items.map((item) => item.id);
      for (const id of knownCartItemIds) {
        if (!selection.has(id)) {
          selection.set(id, true);
        }
      }
      publishMallH5CartCount(snapshot.items.length);
      return snapshot.items.map(toBrickCartItem);
    },
    async updateQuantity(cartItemId: string, quantity: number): Promise<void> {
      await updateMallH5CartItem({ cartItemId, quantity });
    },
    async toggleCheck(cartItemId: string, checked: boolean): Promise<void> {
      selection.set(cartItemId, checked);
    },
    async toggleAllCheck(checked: boolean): Promise<void> {
      for (const id of knownCartItemIds) {
        selection.set(id, checked);
      }
    },
    async removeFromCart(cartItemIds: string[]): Promise<void> {
      for (const cartItemId of cartItemIds) {
        await removeMallH5CartItem(cartItemId);
        selection.delete(cartItemId);
      }
      knownCartItemIds = knownCartItemIds.filter((id) => !cartItemIds.includes(id));
    },
    async clearCart(): Promise<void> {
      for (const cartItemId of knownCartItemIds) {
        await removeMallH5CartItem(cartItemId);
      }
      knownCartItemIds = [];
      selection.clear();
    },
  });
}
