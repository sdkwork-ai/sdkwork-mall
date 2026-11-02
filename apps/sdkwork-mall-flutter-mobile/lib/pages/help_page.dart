import 'package:flutter/material.dart';

import '../src/i18n/runtime.dart';
import 'widgets.dart';

/// 帮助中心：与 PC / H5 / 小程序同一份自助服务文案。
///
/// 文案来自 `lib/src/i18n/zh-CN/support/help/messages.json`，由
/// [SdkworkI18n] 在启动时加载；页面只持有 key，不再内联中文。
class SdkworkHelpPage extends StatelessWidget {
  const SdkworkHelpPage({super.key});

  static const List<({String titleKey, List<String> itemKeys})> _sections =
      <({String titleKey, List<String> itemKeys})>[
    (
      titleKey: 'help.sections.orders.title',
      itemKeys: <String>[
        'help.sections.orders.item0',
        'help.sections.orders.item1',
        'help.sections.orders.item2',
      ],
    ),
    (
      titleKey: 'help.sections.afterSales.title',
      itemKeys: <String>[
        'help.sections.afterSales.item0',
        'help.sections.afterSales.item1',
        'help.sections.afterSales.item2',
      ],
    ),
    (
      titleKey: 'help.sections.assets.title',
      itemKeys: <String>[
        'help.sections.assets.item0',
        'help.sections.assets.item1',
        'help.sections.assets.item2',
        'help.sections.assets.item3',
      ],
    ),
    (
      titleKey: 'help.sections.security.title',
      itemKeys: <String>[
        'help.sections.security.item0',
        'help.sections.security.item1',
        'help.sections.security.item2',
      ],
    ),
  ];

  static const List<({String labelKey, String route})> _quickLinks =
      <({String labelKey, String route})>[
    (labelKey: 'help.quick.orders', route: '/orders'),
    (labelKey: 'help.quick.afterSales', route: '/after-sales'),
    (labelKey: 'help.quick.invoices', route: '/invoices'),
    (labelKey: 'help.quick.messages', route: '/messages'),
    (labelKey: 'help.quick.giftCards', route: '/gift-cards'),
    (labelKey: 'help.quick.security', route: '/security'),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(SdkworkI18n.t('help.title'))),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: <Widget>[
          SdkworkSectionHeader(title: SdkworkI18n.t('help.subtitle')),
          ..._sections.map(
            (section) => Card(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      SdkworkI18n.t(section.titleKey),
                      style: theme.textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    ...section.itemKeys.map(
                      (itemKey) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Text(
                          '· ${SdkworkI18n.t(itemKey)}',
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          SdkworkSectionHeader(title: SdkworkI18n.t('help.quick.title')),
          ..._quickLinks.map(
            (link) => Card(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: ListTile(
                leading: const Icon(Icons.arrow_outward, size: 20),
                title: Text(SdkworkI18n.t(link.labelKey)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed(link.route),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              SdkworkI18n.t('help.footer'),
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}
