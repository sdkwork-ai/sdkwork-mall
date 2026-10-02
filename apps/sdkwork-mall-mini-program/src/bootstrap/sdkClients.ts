/**
 * Commerce SDK client contract for the mini-program.
 *
 * The MP runtime cannot execute the generated TypeScript transport that PC/H5
 * consume, so the commerce surface is composed from the hand-authored
 * spec-shaped service modules in `src/services/` — each one maps 1:1 onto the
 * federated commerce app-api domain exactly like the H5 facades (catalog,
 * cart, order, promotion, address). Pages consume the domain services
 * directly via CommonJS; this module is the typed contract they collectively
 * implement. When the generated WeChat MP SDK family lands, each service
 * module swaps its transport calls for the generated client without page
 * changes.
 */
export interface MallMpProductCard {
  id: string;
  imageUrl: string;
  priceCny: number | null;
  sales: number | null;
  title: string;
}

export interface MallMpProductDetail extends MallMpProductCard {
  description: string;
  images: string[];
  shopId: string;
  shopName: string;
  skus: Array<{ id: string; priceCny: number | null; stock: number | null; title: string }>;
  specs: Array<{ name: string; value: string }>;
}

export interface MallMpCatalogService {
  getProductDetail(productId: string): Promise<MallMpProductDetail | null>;
  listCategories(): Promise<Array<{ id: string; name: string; parentId: string }>>;
  listProducts(input: {
    categoryId?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
    shopId?: string;
    sort?: string;
  }): Promise<{ items: MallMpProductCard[]; total: number }>;
}

export interface MallMpCartService {
  addToCart(input: { quantity: number; skuId: string; spuId: string }): Promise<unknown>;
  createCheckoutQuote(input?: { cartItemIds?: string[] }): Promise<{
    discountAmountCny: number | null;
    originalAmountCny: number | null;
    payableAmountCny: number | null;
    quoteId: string;
    sessionId: string;
  }>;
  getCart(): Promise<{
    id: string;
    items: Array<{
      id: string;
      imageUrl: string;
      priceCny: number | null;
      quantity: number;
      shopId: string;
      shopName: string;
      skuId: string;
      skuName: string;
      spuId: string;
      title: string;
    }>;
    totalAmountCny: number;
  }>;
  listPaymentMethods(): Promise<Array<{ code: string; id: string; label: string }>>;
  listUserCoupons(): Promise<
    Array<{
      discountAmountCny: number | null;
      id: string;
      minSpendCny: number | null;
      title: string;
      validUntil: string;
    }>
  >;
  payOrder(orderId: string, paymentMethod: string): Promise<string>;
  removeCartItem(cartItemId: string): Promise<unknown>;
  submitOrder(input: {
    addressId?: string;
    buyerRemark?: string;
    cartItemIds?: string[];
    couponId?: string;
    usePoints?: boolean;
    useWallet?: boolean;
  }): Promise<{ orderId: string }>;
  updateCartItem(cartItemId: string, quantity: number): Promise<unknown>;
}

export interface MallMpOrderService {
  cancelOrder(orderId: string): Promise<unknown>;
  confirmReceipt(orderId: string): Promise<unknown>;
  getOrderDetail(orderId: string): Promise<{
    createdAt: string;
    id: string;
    items: Array<{
      id: string;
      imageUrl: string;
      priceCny: number | null;
      quantity: number;
      skuName: string;
      spuId: string;
      title: string;
    }>;
    paidAmountCny: number | null;
    paymentMethod: string;
    status: string;
    subject: string;
    totalAmountCny: number | null;
  }>;
  getOrderStatistics(): Promise<{
    completed: number;
    pendingPayment: number;
    pendingReceipt: number;
    pendingShipment: number;
    totalOrders: number;
  }>;
  getPaymentSuccess(orderId: string): Promise<Record<string, unknown> | null>;
  listOrders(input?: {
    page?: number;
    pageSize?: number;
    status?: string;
  }): Promise<{ orders: Array<{ createdAt: string; id: string; status: string; subject: string; totalAmountCny: number | null }>; total: number }>;
  payOrder(orderId: string, paymentMethod: string): Promise<string>;
}

export interface MallMpAddressService {
  createAddress(input: { addressLine: string; receiverName: string; receiverPhone: string }): Promise<unknown>;
  deleteAddress(addressId: string): Promise<unknown>;
  listAddresses(): Promise<
    Array<{ addressLine: string; id: string; isDefault: boolean; receiverName: string; receiverPhone: string }>
  >;
  setDefaultAddress(addressId: string): Promise<unknown>;
  updateAddress(addressId: string, input: { addressLine: string; receiverName: string; receiverPhone: string }): Promise<unknown>;
}

export interface MallMpPromotionService {
  claimCoupon(offerId: string): Promise<unknown>;
  listOffers(): Promise<
    Array<{ claimable: boolean; discountText: string; endAt: string; highlight: string; id: string; title: string }>
  >;
  redeemCouponCode(code: string): Promise<unknown>;
}

export interface MallMpCommerceClient {
  addresses: MallMpAddressService;
  cart: MallMpCartService;
  catalog: MallMpCatalogService;
  orders: MallMpOrderService;
  promotions: MallMpPromotionService;
}
