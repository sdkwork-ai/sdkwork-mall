import { unwrapSdkworkPaymentResponse } from "@sdkwork/payment-service";

import { getSdkworkCommerceRemotePort } from "./commerce-remote-port";
import type {
  AvailableCoupon,
  MembershipInfo,
  RecentOrder,
  RecommendedActivity,
} from "./pages/buyer-dashboard-shared";

export interface MallBuyerDashboardSnapshot {
  activities: RecommendedActivity[];
  availableCoupons: AvailableCoupon[];
  membership: MembershipInfo;
  orderStats: {
    completed: number;
    pendingPayment: number;
    pendingReceipt: number;
    pendingShipment: number;
    totalOrders: number;
  };
  pendingAfterSales: number;
  recentOrders: RecentOrder[];
}

export async function loadMallBuyerAccountSummary(): Promise<Record<string, unknown>> {
  const remote = getSdkworkCommerceRemotePort();
  const response = await remote.accounts.current.summary.retrieve({});
  return unwrapSdkworkPaymentResponse(response) as Record<string, unknown>;
}

export async function loadMallBuyerDashboardSnapshot(): Promise<MallBuyerDashboardSnapshot> {
  const remote = getSdkworkCommerceRemotePort();
  const [
    afterSalesResult,
    statsResult,
    ordersResult,
    couponsResult,
    accountResult,
    offersResult,
  ] = await Promise.allSettled([
    remote.afterSales.requests.list({ status: "pending", page: 1, page_size: 1 }),
    remote.orders.statistics.retrieve(),
    remote.orders.list({ page: 1, page_size: 5 }),
    remote.promotions.userCoupons.wallet.list({ page: 1, page_size: 5 }),
    remote.accounts.current.summary.retrieve({}),
    remote.promotions.offers.list({ page: 1, page_size: 4 }),
  ]);

  let pendingAfterSales = 0;
  if (afterSalesResult.status === "fulfilled") {
    const payload = unwrapSdkworkPaymentResponse(afterSalesResult.value) as { total?: number };
    pendingAfterSales = payload.total ?? 0;
  }

  let orderStats = {
    completed: 0,
    pendingPayment: 0,
    pendingReceipt: 0,
    pendingShipment: 0,
    totalOrders: 0,
  };
  if (statsResult.status === "fulfilled") {
    const payload = unwrapSdkworkPaymentResponse(statsResult.value) as Record<string, unknown>;
    orderStats = {
      totalOrders: Number(payload.totalOrders ?? payload.total_orders ?? 0),
      pendingPayment: Number(payload.pendingPayment ?? payload.pending_payment ?? 0),
      pendingShipment: Number(payload.pendingShipment ?? payload.pending_shipment ?? 0),
      pendingReceipt: Number(payload.pendingReceipt ?? payload.pending_receipt ?? 0),
      completed: Number(payload.completed ?? 0),
    };
  }

  let recentOrders: RecentOrder[] = [];
  if (ordersResult.status === "fulfilled") {
    const payload = unwrapSdkworkPaymentResponse(ordersResult.value) as { items?: Record<string, unknown>[] };
    recentOrders =
      payload.items?.map((item) => ({
        id: String(item.id ?? ""),
        title: String(item.subject ?? item.title ?? "订单"),
        status: String(item.status ?? ""),
        totalCny:
          typeof item.totalAmount === "number"
            ? item.totalAmount
            : typeof item.total === "number"
              ? item.total
              : undefined,
        createdAt:
          typeof item.createdAt === "string"
            ? item.createdAt
            : typeof item.created_at === "string"
              ? item.created_at
              : undefined,
      })) ?? [];
  }

  let availableCoupons: AvailableCoupon[] = [];
  if (couponsResult.status === "fulfilled") {
    const payload = unwrapSdkworkPaymentResponse(couponsResult.value) as { items?: Record<string, unknown>[] };
    availableCoupons =
      payload.items?.map((item) => ({
        id: String(item.id ?? item.userCouponId ?? item.couponId ?? ""),
        title: String(item.title ?? item.couponName ?? item.name ?? "优惠券"),
        discountText:
          typeof item.discountText === "string"
            ? item.discountText
            : typeof item.discount === "string"
              ? item.discount
              : undefined,
        expiresAt:
          typeof item.expiresAt === "string"
            ? item.expiresAt
            : typeof item.endAt === "string"
              ? item.endAt
              : undefined,
      })) ?? [];
  }

  let membership: MembershipInfo = {};
  if (accountResult.status === "fulfilled") {
    const payload = unwrapSdkworkPaymentResponse(accountResult.value) as Record<string, unknown>;
    membership = {
      level:
        typeof payload.membershipLevel === "string"
          ? payload.membershipLevel
          : typeof payload.level === "string"
            ? payload.level
            : undefined,
      growthValue:
        typeof payload.growthValue === "number"
          ? payload.growthValue
          : typeof payload.growth === "number"
            ? payload.growth
            : undefined,
      nextLevel: typeof payload.nextLevel === "string" ? payload.nextLevel : undefined,
      nextLevelGrowth:
        typeof payload.nextLevelGrowth === "number" ? payload.nextLevelGrowth : undefined,
    };
  }

  let activities: RecommendedActivity[] = [];
  if (offersResult.status === "fulfilled") {
    const payload = unwrapSdkworkPaymentResponse(offersResult.value) as { items?: Record<string, unknown>[] };
    activities =
      payload.items?.slice(0, 4).map((item) => ({
        id: String(item.id ?? ""),
        title: String(item.title ?? item.name ?? "活动"),
        description: typeof item.description === "string" ? item.description : undefined,
        endAt:
          typeof item.endAt === "string"
            ? item.endAt
            : typeof item.end_at === "string"
              ? item.end_at
              : undefined,
      })) ?? [];
  }

  return {
    activities,
    availableCoupons,
    membership,
    orderStats,
    pendingAfterSales,
    recentOrders,
  };
}
