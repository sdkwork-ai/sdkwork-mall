import 'package:flutter/material.dart';

import 'widgets.dart';

/// 帮助中心：与 PC / H5 / 小程序同一份自助服务文案。
class SdkworkHelpPage extends StatelessWidget {
  const SdkworkHelpPage({super.key});

  static const List<({String title, List<String> items})> _sections =
      <({String title, List<String> items})>[
    (
      title: '订单与物流',
      items: <String>[
        '在买家中心「我的订单」查看订单状态与物流信息',
        '未发货前可联系客服尝试修改收货地址',
        '支付成功后可在「支付结果」页查看支付单号',
      ],
    ),
    (
      title: '售后服务',
      items: <String>[
        '已完成订单可在「我的评价」查看待评价商品',
        '在「售后中心」发起退款、退货或换货申请',
        '售后进度同步至「消息中心」',
      ],
    ),
    (
      title: '发票与资产',
      items: <String>[
        '「发票」页申请电子/纸质发票',
        '「优惠券」「积分」「我的钱包」统一管理优惠资产',
        '「礼品卡」页预留红包与礼品卡入口（待 SDK）',
        '会员权益在「会员中心」查看与续费',
      ],
    ),
    (
      title: '账户安全',
      items: <String>[
        '通过登录页重新认证以修改密码与绑定手机',
        '「账户与安全」查看当前登录账户信息',
        '异常登录请及时修改密码并联系平台客服',
      ],
    ),
  ];

  static const List<({String label, String route})> _quickLinks =
      <({String label, String route})>[
    (label: '订单查询', route: '/orders'),
    (label: '售后服务', route: '/after-sales'),
    (label: '发票开具', route: '/invoices'),
    (label: '消息通知', route: '/messages'),
    (label: '礼品卡', route: '/gift-cards'),
    (label: '账户安全', route: '/security'),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('帮助中心')),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: <Widget>[
          const SdkworkSectionHeader(title: '常见问题与自助服务'),
          ..._sections.map(
            (section) => Card(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(section.title, style: theme.textTheme.titleSmall),
                    const SizedBox(height: 8),
                    ...section.items.map(
                      (item) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Text(
                          '· $item',
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SdkworkSectionHeader(title: '快捷入口'),
          ..._quickLinks.map(
            (link) => Card(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: ListTile(
                leading: const Icon(Icons.arrow_outward, size: 20),
                title: Text(link.label),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed(link.route),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              '在线客服：工作日 9:00–22:00；商家合作请联系平台招商。',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}
