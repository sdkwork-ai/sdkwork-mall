import { AccountWalletPointsPage } from "@sdkwork/account-mobile-react-wallet";

/**
 * Points surface. Owned by the account wallet brick (available-points hero,
 * expiring lots, empty/error states); the host only supplies the runtime.
 */
export function SdkworkMallH5PointsPage() {
  return <AccountWalletPointsPage />;
}
