import 'dart:convert';
import 'dart:io';

import 'package:sdkwork_mall_flutter_mobile/src/i18n/runtime.dart';

const List<String> _fragments = <String>[
  'lib/src/i18n/zh-CN/support/help/messages.json',
  'lib/src/i18n/zh-CN/storefront/home/messages.json',
  'lib/src/i18n/zh-CN/catalog/product-detail/messages.json',
  'lib/src/i18n/zh-CN/marketing/pages/messages.json',
  'lib/src/i18n/zh-CN/support/after-sales/messages.json',
  'lib/src/i18n/zh-CN/account/buyer-hub/messages.json',
  'lib/src/i18n/zh-CN/account/membership/messages.json',
  'lib/src/i18n/zh-CN/account/wallet/messages.json',
  'lib/src/i18n/zh-CN/account/settings-invoices/messages.json',
  'lib/src/i18n/zh-CN/checkout/confirm-order/messages.json',
  'lib/src/i18n/zh-CN/checkout/cashier/messages.json',
];

/// Installs the authored zh-CN fragments into the runtime for widget tests.
///
/// Tests read the fragments from disk instead of the asset bundle so the suite
/// does not depend on `flutter test` asset resolution, while production loads
/// the same files through `rootBundle` in `main()`.
void installTestI18n() {
  final merged = <String, dynamic>{};
  for (final path in _fragments) {
    final decoded = jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;
    _merge(merged, decoded);
  }
  SdkworkI18n.installForTest(merged);
}

void _merge(Map<String, dynamic> target, Map<String, dynamic> source) {
  source.forEach((key, value) {
    final existing = target[key];
    if (existing is Map<String, dynamic> && value is Map<String, dynamic>) {
      _merge(existing, value);
    } else {
      target[key] = value;
    }
  });
}
