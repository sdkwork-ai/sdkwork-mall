import { configureAccountWalletRuntime } from "@sdkwork/account-mobile-react-wallet";

import {
  loadMallH5CashLedger,
  loadMallH5Points,
  loadMallH5WalletOverview,
} from "./account-service";

/**
 * Binds the mall account data plane to the wallet brick's runtime port.
 *
 * The brick owns the wallet/points screens (balance hero, cash ledger, point
 * lots, empty/loading/error states); the mall only projects its account-service
 * read models.
 */
export function configureSdkworkMallH5WalletBrick(): void {
  configureAccountWalletRuntime({
    async loadCashLedger() {
      return loadMallH5CashLedger();
    },
    async loadOverview() {
      const overview = await loadMallH5WalletOverview();
      return {
        cashBalanceCny: overview?.cashBalanceCny ?? null,
        pointsBalance: overview?.pointsBalance ?? null,
      };
    },
    async loadPoints() {
      const summary = await loadMallH5Points();
      return {
        balance: summary?.balance ?? null,
        lots: summary?.lots ?? [],
      };
    },
  });
}
