import {
  configureSdkworkAccountAppServiceProvider,
  configureSdkworkAccountSessionTokenProvider,
  createSdkworkAccountAppService,
} from "@sdkwork/account-service";
import {
  configureSdkworkMembershipAppServiceProvider,
  configureSdkworkMembershipSessionTokenProvider,
  createSdkworkMembershipAppService,
} from "@sdkwork/membership-service";
import {
  configureSdkworkOrderAppServiceProvider,
  configureSdkworkOrderSessionTokenProvider,
  createSdkworkOrderAppService,
} from "@sdkwork/order-service";
import {
  configureSdkworkPaymentAppServiceProvider,
  configureSdkworkPaymentSessionTokenProvider,
  createSdkworkPaymentAppService,
} from "@sdkwork/payment-service";
import {
  configureSdkworkPromotionAppServiceProvider,
  configureSdkworkPromotionSessionTokenProvider,
  createSdkworkPromotionAppService,
} from "@sdkwork/promotion-service";

import type { SdkworkMallH5SdkClientInventory } from "./sdkClients";

export interface SdkworkMallH5DomainSessionTokens {
  accessToken?: string;
  authToken?: string;
  refreshToken?: string;
}

export function configureSdkworkMallH5DomainServiceProviders(
  sdkClients: SdkworkMallH5SdkClientInventory,
  readSessionTokens: () => SdkworkMallH5DomainSessionTokens,
): void {
  configureSdkworkAccountAppServiceProvider(() => createSdkworkAccountAppService({
    appClient: { commerce: sdkClients.accountAppClient },
  }));
  configureSdkworkMembershipAppServiceProvider(() => createSdkworkMembershipAppService({
    appClient: { commerce: sdkClients.membershipAppClient },
  }));
  configureSdkworkOrderAppServiceProvider(() => createSdkworkOrderAppService({
    appClient: sdkClients.orderAppClient,
  }));
  configureSdkworkPaymentAppServiceProvider(() => createSdkworkPaymentAppService({
    appClient: {
      commerce: { payments: sdkClients.paymentAppClient.commerce.payments },
      refunds: sdkClients.paymentAppClient.commerce.refunds,
    },
  }));
  configureSdkworkPromotionAppServiceProvider(() => {
    const discountApplications = sdkClients.promotionAppClient.promotions.discountApplications;
    return createSdkworkPromotionAppService({
      appClient: {
        commerce: {
          promotions: {
            codes: sdkClients.promotionAppClient.promotions.codes,
            discountApplications: {
              create: discountApplications.create.bind(discountApplications),
              release: discountApplications.releases.create.bind(discountApplications.releases),
              reversals: discountApplications.reversals,
              rollback: discountApplications.rollback.bind(discountApplications),
              settle: discountApplications.settlements.create.bind(discountApplications.settlements),
            },
            offers: sdkClients.promotionAppClient.promotions.offers,
            userCoupons: sdkClients.promotionAppClient.promotions.userCoupons,
          },
        },
      },
    });
  });

  configureSdkworkAccountSessionTokenProvider(readSessionTokens);
  configureSdkworkMembershipSessionTokenProvider(readSessionTokens);
  configureSdkworkOrderSessionTokenProvider(readSessionTokens);
  configureSdkworkPaymentSessionTokenProvider(readSessionTokens);
  configureSdkworkPromotionSessionTokenProvider(readSessionTokens);
}
