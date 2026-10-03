import { errorMessage } from "../../types/common";
import {
  getMembershipStatus,
  listMembershipPlans,
  type MpMembershipPlan,
  type MpMembershipStatus,
} from "../../services/account-service";
import { isLoggedIn } from "../../services/session";

interface MembershipData {
  loading: boolean;
  message: string;
  status: MpMembershipStatus | null;
  plans: MpMembershipPlan[];
}

Page({
  data: {
    loading: true,
    message: "",
    status: null,
    plans: [],
  } as MembershipData,

  onShow() {
    if (!isLoggedIn()) {
      this.setData({ loading: false, message: "请先登录后查看会员信息" });
      return;
    }
    void this.load();
  },

  async load() {
    this.setData({ loading: true, message: "" });
    try {
      const [status, plans] = await Promise.all([getMembershipStatus(), listMembershipPlans()]);
      this.setData({ status, plans, loading: false });
    } catch (cause) {
      this.setData({ loading: false, message: errorMessage(cause, "会员信息加载失败") });
    }
  },
});
