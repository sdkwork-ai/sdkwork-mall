// Authored zh-CN messages for the confirm-order page; see buyer-hub/messages.js
// for the storage rationale (JS data + sibling .d.ts).
module.exports = {
  checkout: {
    loading: "加载结算信息...",
    retry: "重试",
    selectedCount: "已选择 {{count}} 件购物车商品参与结算",
    address: {
      title: "收货地址",
      manage: "管理地址",
      empty: "请先添加收货地址",
      default: "默认",
    },
    delivery: {
      title: "配送方式",
      standard: {
        label: "普通配送",
        description: "3-5 天送达 · 免费",
      },
      express: {
        label: "极速达",
        description: "次日送达 · ¥12.00",
      },
      sf: {
        label: "顺丰速运",
        description: "当日达 · ¥22.00",
      },
    },
    coupon: {
      title: "优惠券",
      none: "不使用优惠券",
      threshold: "满 ¥{{amount}} 可用",
      empty: "暂无可用优惠券，可到领券中心领取。",
    },
    deduct: {
      title: "抵扣",
      wallet: "钱包余额抵扣",
      points: "积分抵扣",
    },
    giftCard: {
      title: "礼品卡",
      applied: "已使用礼品卡 {{code}}",
      remove: "移除",
      placeholder: "输入礼品卡卡号",
      apply: "使用",
      required: "请输入礼品卡卡号",
      invalid: "礼品卡卡号格式不正确",
    },
    remark: {
      title: "买家留言",
      placeholder: "选填，给商家留言",
    },
    invoice: {
      need: "需要开具发票",
      personal: "个人",
      company: "企业",
      titleLabel: "发票抬头",
      titlePlaceholder: "个人姓名或公司名称",
      taxLabel: "税号",
      taxPlaceholder: "15-20 位字母或数字",
      emailLabel: "接收邮箱（选填）",
      emailPlaceholder: "用于接收电子发票",
      titleRequiredCompany: "请填写发票抬头（公司名称）",
      titleRequiredPersonal: "请填写发票抬头（个人姓名）",
      taxRequired: "请填写企业税号",
      taxInvalid: "税号格式不正确（15-20 位字母或数字）",
    },
    summary: {
      goods: "商品金额",
      discount: "优惠",
      payable: "应付金额",
    },
    errors: {
      quoteLoad: "应付金额加载失败",
      load: "结算信息加载失败",
      addressRequired: "请选择收货地址",
      quoteNotReady: "应付金额未就绪，请重试",
      submitFailed: "提交订单失败",
      warningsTitle: "部分优惠未生效",
    },
    submit: "提交订单",
    submitting: "提交中...",
  },
};
