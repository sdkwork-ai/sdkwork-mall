import { useEffect, useState } from "react";
import { Button } from "@sdkwork/ui-pc-react";
import {
  listMallAdminRoleNames,
  readSelectedMallAdminRole,
  writeSelectedMallAdminRole,
} from "../role-matrix";

const mallAdminRoles = [
  {
    name: "超级管理员",
    permissions: ["commerce.*"],
  },
  {
    name: "商家运营",
    permissions: ["commerce.shops.read", "commerce.shops.review", "commerce.products.read"],
  },
  {
    name: "订单督导",
    permissions: ["commerce.orders.read", "commerce.afterSales.read"],
  },
  {
    name: "营销运营",
    permissions: ["commerce.promotions.read", "commerce.promotions.write", "commerce.cms.write"],
  },
  {
    name: "财务",
    permissions: ["commerce.settlement.read", "commerce.reports.read"],
  },
  {
    name: "风控分析",
    permissions: ["commerce.risk.read", "commerce.audit.read"],
  },
] as const;

export function SdkworkMallAdminPermissionsPage() {
  // No default role: an account that never chose one has minimal permissions.
  const [activeRole, setActiveRole] = useState<string | null>(() => readSelectedMallAdminRole());

  useEffect(() => {
    if (activeRole) {
      writeSelectedMallAdminRole(activeRole);
    }
  }, [activeRole]);

  return (
    <div>
      <h1>权限管理</h1>
      <p>
        选择当前后台会话生效角色，路由守卫按 permissionHint 做体验层校验；
        真正授权始终以服务端对当前会话权限的断言为准。
      </p>

      <section className="sdkwork-mall-pc-form-grid">
        <label>
          当前角色
          <select
            onChange={(event) => setActiveRole(event.target.value || null)}
            value={activeRole ?? ""}
          >
            <option value="">未选择角色（最小权限）</option>
            {listMallAdminRoleNames().map((roleName) => (
              <option key={roleName} value={roleName}>{roleName}</option>
            ))}
          </select>
        </label>
      </section>

      <table className="sdkwork-mall-pc-table">
        <thead>
          <tr>
            <th>角色</th>
            <th>权限</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {mallAdminRoles.map((role) => (
            <tr key={role.name}>
              <td>{role.name}</td>
              <td>{role.permissions.join(", ")}</td>
              <td>
                <Button onClick={() => setActiveRole(role.name)} type="button">
                  切换
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>IAM 会话、角色分配与审计传播由 appbase IAM 运行时负责；生产环境应改为服务端权限断言。</p>
    </div>
  );
}
