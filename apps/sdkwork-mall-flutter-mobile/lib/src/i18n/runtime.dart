import 'dart:convert';

import 'package:flutter/services.dart' show AssetBundle, rootBundle;

/// Lightweight runtime i18n for the Flutter client.
///
/// Messages are authored as JSON fragments under
/// `lib/src/i18n/<locale>/<domain>/<capability>/messages.json`, loaded once at
/// startup. `t()` stays synchronous so widgets never await copy, and a missing
/// fragment degrades to showing the key instead of blocking the app.
class SdkworkI18n {
  SdkworkI18n._();

  static const String defaultLocale = 'zh-CN';

  static const List<String> _fragments = <String>[
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
  ];

  static final Map<String, String> _messages = <String, String>{};
  static bool _loaded = false;

  static bool get isLoaded => _loaded;

  /// Loads every authored fragment once. Safe to call more than once.
  static Future<void> load({AssetBundle? bundle}) async {
    if (_loaded) {
      return;
    }
    final source = bundle ?? rootBundle;
    for (final asset in _fragments) {
      try {
        final raw = await source.loadString(asset);
        final decoded = jsonDecode(raw);
        if (decoded is Map<String, dynamic>) {
          _collect(decoded, '', _messages);
        }
      } catch (_) {
        // A missing fragment must degrade to keys, never block startup.
      }
    }
    _loaded = true;
  }

  /// Resolves [key] with `{{name}}` placeholder interpolation.
  static String t(
    String key, {
    Map<String, String> params = const <String, String>{},
  }) {
    var value = _messages[key] ?? key;
    params.forEach((name, replacement) {
      value = value.replaceAll('{{$name}}', replacement);
    });
    return value;
  }

  /// Installs a decoded message tree directly (used by tests and tooling).
  static void installForTest(Map<String, dynamic> messages) {
    _messages.clear();
    _collect(messages, '', _messages);
    _loaded = true;
  }

  static void _collect(
    Map<String, dynamic> node,
    String prefix,
    Map<String, String> out,
  ) {
    node.forEach((key, value) {
      final path = prefix.isEmpty ? key : '$prefix.$key';
      if (value is Map<String, dynamic>) {
        _collect(value, path, out);
      } else if (value != null) {
        out[path] = '$value';
      }
    });
  }
}
