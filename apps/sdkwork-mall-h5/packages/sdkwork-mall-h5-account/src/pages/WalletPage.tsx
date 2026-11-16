import { AccountWalletWalletPage } from "@sdkwork/account-mobile-react-wallet";

/**
 * Cash wallet surface. The page (balance hero, cash ledger, empty/error
 * states) is owned by the account wallet brick; the mall account package only
 * injects its data plane through `src/wallet-brick.ts`.
 */
export function SdkworkMallH5WalletPage() {
  return <AccountWalletWalletPage />;
}
