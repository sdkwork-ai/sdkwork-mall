import { Link } from "react-router-dom";
import { EmptyState, LoadingBlock } from "@sdkwork/ui-pc-react";
import { unwrapSdkworkPaymentResponse } from "@sdkwork/payment-service";
import { getSdkworkAdminRemotePort } from "@sdkwork/mall-pc-admin-core/admin-remote-port";
import { useEffect, useState } from "react";

export function SdkworkMallAdminUsersPage() {
  return (
    <div>
      <h1>用户中心</h1>
      <EmptyState
        description="平台用户查询、风控标记与账户处置需等待 admin.users 管理 API 合约落地。"
        title="用户管理（待 SDK）"
      />
      <p>
        当前可通过 <Link to="/admin/orders">订单监管</Link> 与{" "}
        <Link to="/admin/audit">审计日志</Link> 间接追踪用户行为。
      </p>
    </div>
  );
}

const BRAND_SHOP_PAGE_SIZE = 20;

export function SdkworkMallAdminBrandsPage() {
  const [rows, setRows] = useState<Array<{ brandName: string; shopName: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const service = getSdkworkAdminRemotePort();
      const shopsResponse = await service.admin.shops.management.list({
        page: 1,
        page_size: BRAND_SHOP_PAGE_SIZE,
      });
      const shopsPayload = unwrapSdkworkPaymentResponse(shopsResponse) as { items?: Record<string, unknown>[] };

      // Concurrent per-shop brand authorization lookups; shops without the
      // endpoint in dev environments contribute zero rows instead of failing.
      const perShopRows = await Promise.all(
        (shopsPayload.items ?? []).map(async (shop) => {
          const shopId = String(shop.id ?? "");
          if (!shopId) {
            return [];
          }
          try {
            const brandResponse = await service.admin.shops.brandAuthorizations.list(shopId, {
              page: 1,
              page_size: BRAND_SHOP_PAGE_SIZE,
            });
            const brandPayload = unwrapSdkworkPaymentResponse(brandResponse) as {
              items?: Record<string, unknown>[];
            };
            return (brandPayload.items ?? []).map((brand) => ({
              shopName: String(shop.name ?? shop.title ?? shopId),
              brandName: String(brand.brandName ?? brand.brand_name ?? "品牌"),
              status: String(brand.authorizationStatus ?? brand.authorization_status ?? "pending"),
            }));
          } catch {
            return [];
          }
        }),
      );

      if (active) {
        setRows(perShopRows.flat());
        setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <LoadingBlock label="加载品牌授权..." />;
  }

  return (
    <div>
      <h1>品牌中心</h1>
      <p>汇总商家品牌授权；平台级品牌库与类目绑定治理待 catalog.brands 专用 API。</p>
      {rows.length === 0 ? (
        <EmptyState description="商家提交品牌授权后将在此展示" title="暂无品牌授权" />
      ) : (
        <table className="sdkwork-mall-pc-table">
          <thead>
            <tr>
              <th>品牌</th>
              <th>店铺</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.brandName}-${row.shopName}-${index}`}>
                <td>{row.brandName}</td>
                <td>{row.shopName}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function SdkworkMallAdminModerationPage() {
  return (
    <div>
      <h1>举报与处罚</h1>
      <EmptyState
        description="举报受理、违规处罚与申诉流程需等待 admin.moderation 专用 API 合约落地。"
        title="治理中心（待 SDK）"
      />
      <p>
        当前可通过 <Link to="/admin/risk">风控中心</Link> 处理风险信号，通过{" "}
        <Link to="/admin/shops">商家管理</Link> 暂停违规店铺。
      </p>
    </div>
  );
}
