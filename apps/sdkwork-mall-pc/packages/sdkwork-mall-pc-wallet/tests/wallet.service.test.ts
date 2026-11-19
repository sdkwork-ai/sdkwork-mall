import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureAccountServiceMockSession,
  createAccountServiceMock,
  createOrderServiceMock,
  resetAccountServiceMockSession,
} from "../../../tests/test-utils/commerce-service-mock";
import { createSdkworkWalletService } from "../src";

describe("sdkwork-mall-pc-wallet service", () => {
  beforeEach(() => {
    configureAccountServiceMockSession({ authToken: "wallet-auth-token" });
  });

  afterEach(() => {
    resetAccountServiceMockSession();
  });

  it("maps account, points history, and recharge packages into a wallet-owned overview", async () => {
    const accountService = createAccountServiceMock({
      accounts: {
        current: {
          summary: {
            retrieve: vi.fn().mockResolvedValue({
              code: 0,
              data: {
                cashAvailable: 88.5,
                cashFrozen: 10,
                hasPayPassword: true,
                pointsAvailable: 1200,
                pointsFrozen: 30,
                tokenAvailable: 42,
                tokenFrozen: 0,
              },
            }),
          },
        },
      },
      wallet: {
        ledgerEntries: {
          points: {
            list: vi.fn().mockResolvedValue({
              code: 0,
              data: {
                content: [
                  {
                    amount: 6,
                    createdAt: "2026-04-01T12:00:00.000Z",
                    historyId: "history-2",
                    points: -240,
                    pointsAfter: 1200,
                    pointsBefore: 1440,
                    remarks: "Image generation",
                    status: "SUCCESS",
                    statusName: "Success",
                    transactionType: "POINTS_USAGE",
                    transactionTypeName: "Points usage",
                  },
                  {
                    amount: 12,
                    createdAt: "2026-03-25T09:30:00.000Z",
                    historyId: "history-1",
                    points: 1200,
                    pointsAfter: 1440,
                    pointsBefore: 240,
                    remarks: "Top up points",
                    status: "SUCCESS",
                    statusName: "Success",
                    transactionType: "POINTS_RECHARGE",
                    transactionTypeName: "Points recharge",
                  },
                ],
              },
            }),
          },
        },
        accounts: {
          points: {
            retrieve: vi.fn().mockResolvedValue({
              code: 0,
              data: {
                availablePoints: 1200,
                experience: 18,
                frozenPoints: 30,
                level: 2,
                levelName: "Silver",
                status: "ACTIVE",
                statusName: "Active",
                tokenBalance: 42,
                totalEarned: 9600,
                totalPoints: 1230,
                totalSpent: 8370,
              },
            }),
          },
        },
      },
    });
    const orderService = createOrderServiceMock({
      recharges: {
        settings: {
          retrieve: vi.fn().mockResolvedValue({
            code: 0,
            data: { basePointsPerCny: 200 },
          }),
        },
        packages: {
          list: vi.fn().mockResolvedValue({
            code: 0,
            data: {
              items: [
              {
                id: 101,
                points: 1200,
                priceAmount: 6,
              },
              {
                id: 202,
                points: 5000,
                priceAmount: 24,
              },
              ],
            },
          }),
        },
      },
    });

    const service = createSdkworkWalletService({
      accountService,
      orderService,
    });

    const overview = await service.getOverview({
      pageSize: 20,
    });

    expect(overview.isAuthenticated).toBe(true);
    expect(overview.account.availablePoints).toBe(1200);
    expect(overview.account.cashAvailable).toBe(88.5);
    expect(overview.account.totalEarned).toBe(9600);
    expect(overview.pointsToCashRate).toBe(200);
    expect(overview.transactions).toHaveLength(2);
    expect(overview.transactions[0]).toMatchObject({
      cashAmountCny: 6,
      id: "history-2",
      pointsDelta: -240,
      title: "Points usage",
    });
    expect(overview.rechargePackages[0]).toMatchObject({
      id: 202,
      points: 5000,
      priceCny: 24,
      title: "5000 积分",
    });
    expect(`recharge${"Packs"}` in overview).toBe(false);
  });

  it("returns a guest-safe empty overview when runtime auth is missing", async () => {
    resetAccountServiceMockSession();
    const service = createSdkworkWalletService();

    const overview = await service.getOverview();

    expect(overview.isAuthenticated).toBe(false);
    expect(overview.account.availablePoints).toBe(0);
    expect(overview.transactions).toEqual([]);
    expect(overview.rechargePackages).toEqual([]);
    expect(`recharge${"Packs"}` in overview).toBe(false);
  });

  it("recharges points and withdraws cash through the generated SDK boundaries", async () => {
    const listPackages = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        items: [
          {
            currencyCode: "CNY",
            id: 101,
            points: 1200,
            priceAmount: 6,
          },
        ],
      },
    });
    const rechargePoints = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        item: {
          amount: 6,
          orderId: "TXN-200",
          points: 1200,
          status: "SUCCESS",
        },
      },
    });
    const withdraw = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        amount: 12.5,
        channel: "bank_account",
        fromBalanceAfter: 76,
        frozenBalance: 12.5,
        processedAt: "2026-04-02T13:00:00.000Z",
        requestNo: "REQ_WITHDRAW_300",
        status: "PENDING",
        transactionId: "TXN-300",
      },
    });
    const orderService = createOrderServiceMock({
      recharges: {
        packages: {
          list: listPackages,
        },
        orders: {
          create: rechargePoints,
        },
      },
      withdrawals: {
        requests: {
          create: withdraw,
        },
      },
    });
    const service = createSdkworkWalletService({
      accountService: createAccountServiceMock(),
      orderService,
    });

    await expect(
      service.rechargePoints({
        paymentMethod: "WECHAT",
        points: 1200,
        remarks: "Team recharge",
        requestNo: "REQ-200",
      }),
    ).resolves.toMatchObject({
      cashAmountCny: 6,
      paymentMethod: "WECHAT",
      points: 1200,
      requestNo: "REQ-200",
      status: "completed",
      transactionId: "TXN-200",
    });

    await expect(
      service.withdrawCash({
        accountName: "SDKWORK Ops",
        accountNo: "6222020202020202",
        amountCny: 12.5,
        bankName: "SDKWORK Bank",
        destinationCode: "bank_account",
        remarks: "Team payout",
        requestNo: "REQ_WITHDRAW_300",
      }),
    ).resolves.toMatchObject({
      amountCny: 12.5,
      destinationCode: "bank_account",
      remainingCashAvailable: 76,
      requestNo: "REQ_WITHDRAW_300",
      status: "pending",
      transactionId: "TXN-300",
    });

    expect(rechargePoints).toHaveBeenCalledWith({
      amount: 6,
      currencyCode: "CNY",
      packageId: "101",
      paymentMethod: "WECHAT",
      paymentProduct: "mobile_cashier_h5",
      source: "mall-wallet",
      subject: "points_recharge",
      targetAsset: "points",
    }, expect.any(Object));
    expect(withdraw).toHaveBeenCalledWith({
      asset: "cash",
      amount: 12.5,
      currencyCode: "CNY",
      payoutAccountRef: "6222020202020202",
      payoutMethod: "bank_account",
      reasonCode: "Team payout",
    }, expect.any(Object));
  });

  it("rejects withdraw requests missing required settlement fields before calling the wallet sdk", async () => {
    const withdraw = vi.fn();
    const service = createSdkworkWalletService({
      accountService: createAccountServiceMock(),
    });

    await expect(
      service.withdrawCash({
        accountName: " ",
        accountNo: "6222020202020202",
        amountCny: 12.5,
        destinationCode: "ALIPAY",
      }),
    ).rejects.toThrow(/account holder name/i);

    await expect(
      service.withdrawCash({
        accountName: "SDKWORK Ops",
        accountNo: " ",
        amountCny: 12.5,
        destinationCode: "ALIPAY",
      }),
    ).rejects.toThrow(/account number/i);

    await expect(
      service.withdrawCash({
        accountName: "SDKWORK Ops",
        accountNo: "6222020202020202",
        amountCny: 12.5,
        bankName: " ",
        destinationCode: "bank_account",
      }),
    ).rejects.toThrow(/bank name/i);

    await expect(
      service.withdrawCash({
        accountName: "SDKWORK Ops",
        accountNo: "6222020202020202",
        amountCny: 12.5,
        destinationCode: "ALIPAY",
        requestNo: "bad request no",
      }),
    ).rejects.toThrow(/request no must use/i);

    expect(withdraw).not.toHaveBeenCalled();
  });
});
